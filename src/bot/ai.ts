import { buildPromptWithCustom } from "./prompt";
import { state } from "../shared/state";
import { addEvent } from "../shared/state";
import type { HistoryMessage } from "./history";
import type { AIExtractionResult } from "../core/types";
import { getCodexReply } from "./codex";

const FALLBACK_MODEL = "gemma-3-27b-it";

// Tracks which model was actually used in the last callAI invocation
export let lastUsedModel = "";

export async function getReply(history: HistoryMessage[], ragContext: string = "", userId: string = ""): Promise<string> {
  const basePrompt = buildPromptWithCustom(userId);
  const parts = [`<persona>\n${basePrompt}\n</persona>`];
  if (ragContext) parts.push(`<memory>\n${ragContext}\n</memory>`);
  parts.push(`<task>\n위 대화에 자연스럽게 답변해. persona의 성격과 말투를 반드시 유지해.\n</task>`);
  return callAI(history, parts.join("\n\n"));
}

export async function answerMemoryQuery(history: HistoryMessage[], memoryContext: string = "", userId: string = ""): Promise<string> {
  const basePrompt = buildPromptWithCustom(userId);
  const parts = [`<persona>\n${basePrompt}\n</persona>`];
  if (memoryContext) parts.push(`<memory>\n${memoryContext}\n</memory>`);
  parts.push(`<task>
너는 shared-memory discord assistant야.
유저 질문에 답할 때 memory에 들어있는 정보가 있으면 그걸 우선 사용해.
모르는 내용은 지어내지 말고, 기억에 없다고 솔직히 말해.
약속/이벤트 질문이면 시간, 장소, 상태를 우선 정리해.
과거 대화를 직접 장문으로 복붙하지 말고 자연스럽게 요약해서 답해.
persona의 성격과 말투는 유지하되, 정보 정확성을 우선해.
</task>`);
  return callAI(history, parts.join("\n\n"));
}

export async function summarizeImageMemory(image: NonNullable<HistoryMessage["imageData"]>, caption: string = ""): Promise<{ summary: string; tags: string[] }> {
  const prompt = [
    "너는 디스코드에 올라온 이미지를 shared memory용으로 짧게 설명하는 시스템이야.",
    "반드시 JSON만 출력해.",
    `{"summary":"string","tags":["string"]}`,
    "summary는 한 문장, tags는 1~5개 키워드만 넣어.",
    "사람을 특정하지 말고, 보이는 내용과 맥락만 간단히 적어.",
    caption ? `참고 텍스트: ${caption}` : "",
  ].filter(Boolean).join("\n");

  const raw = await callAI([
    {
      role: "user",
      content: caption || "이미지를 설명해줘.",
      imageData: image,
    },
  ], prompt);

  const parsed = parseJsonObject<{ summary?: string; tags?: string[] }>(raw);
  return {
    summary: parsed.summary || "이미지 첨부",
    tags: parsed.tags || [],
  };
}

function parseJsonObject<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI JSON 응답을 파싱할 수 없습니다.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export async function extractMemoriesWithAI(history: HistoryMessage[], userId: string = ""): Promise<AIExtractionResult> {
  const basePrompt = buildPromptWithCustom(userId);
  const prompt = [
    "<role>",
    "너는 디스코드 대화를 구조화된 기억으로 추출하는 시스템이야.",
    "캐릭터 말투를 사용하지 말고 JSON만 출력해.",
    "</role>",
    "<persona>",
    basePrompt,
    "</persona>",
    "<task>",
    [
      "아래 대화에서 장기적으로 가치 있는 정보만 추출해.",
      "중요하지 않은 인사, 감탄사, 짧은 리액션은 무시해.",
      "반드시 아래 JSON 스키마만 출력해.",
      `{
  "userMemories": [{"category":"fact|preference|status|joke","content":"string","confidence":0.0}],
  "sharedMemories": [{"kind":"event|joke|place|photo|summary","content":"string","relatedUserIds":["string"],"tags":["string"],"confidence":0.0}],
  "relationshipMemories": [{"kind":"close|tease|game|schedule|conflict","content":"string","userA":"string","userB":"string","confidence":0.0}],
  "events": [{"title":"string","description":"string","status":"proposed|confirmed|done|canceled","timeText":"string","locationText":"string","participants":["string"]}]
}`,
      "값이 없으면 빈 배열을 사용해.",
      "확신이 낮거나 일회성 잡담이면 추출하지 마.",
      "userA, userB, participants에는 대화에 등장한 displayName을 사용해.",
    ].join("\n"),
    "</task>",
  ].join("\n");

  const raw = await callAI(history, prompt);
  const parsed = parseJsonObject<Partial<AIExtractionResult>>(raw);

  return {
    userMemories: parsed.userMemories ?? [],
    sharedMemories: parsed.sharedMemories ?? [],
    relationshipMemories: parsed.relationshipMemories ?? [],
    events: parsed.events ?? [],
  };
}

export const DEFAULT_JUDGE_PROMPT = `너는 디스코드 채팅방을 지켜보는 봇이야.
아래 대화를 보고, 네가 자연스럽게 끼어들 수 있는 상황이면 답변해.
끼어드는 게 어색하거나 굳이 필요 없으면 정확히 "<SKIP>"이라고만 답해.

중요: 기본값은 "<SKIP>"이야. 확실히 끼어들 만한 이유가 있을 때만 답변해. 애매하면 SKIP해.

<rules>
끼어들면 좋은 상황:
- 누가 너에 대해 직접 이야기하거나 의견을 물을 때
- 네가 확실히 재밌는 드립을 칠 수 있을 때
- 질문이 공중에 떠 있고 아무도 안 답할 때
- 대화가 한참 멈춰서 분위기가 심심할 때
- 누가 링크를 공유했는데 아무도 반응이 없을 때
- 이미지가 첨부되었는데 재밌거나 반응할 만할 때

끼어들지 말아야 할 상황:
- 두 사람이 대화를 주고받는 중이면 절대 끼어들지 마 (티키타카 중엔 SKIP)
- 대화가 잘 흘러가고 있으면 굳이 끼어들 필요 없어
- 맥락을 잘 모르는 대화일 때
- 방금 네가 이미 말한 직후일 때
- 상대방이 아직 말을 끝내지 않은 것 같을 때
- "ㅋㅋ", "ㅇㅇ", "ㄹㅇ", "ㅇㅈ" 같은 짧은 리액션만 있을 때
- 누군가의 말에 다른 사람이 이미 잘 대답했을 때
</rules>

<examples>
<example>
<conversation>A: 오늘 치킨 먹을까 / B: 오 좋아 뭐 시키지</conversation>
<reasoning>두 사람이 티키타카 중</reasoning>
<decision><SKIP></decision>
</example>
<example>
<conversation>A: 이 버그 어떻게 고치지...</conversation>
<reasoning>질문이 허공에 떠 있고 아무도 안 답함</reasoning>
<decision>답변</decision>
</example>
<example>
<conversation>A: ㅋㅋㅋㅋ / B: ㄹㅇ</conversation>
<reasoning>짧은 리액션만 오감</reasoning>
<decision><SKIP></decision>
</example>
<example>
<conversation>A: 토로 요즘 뭐해?</conversation>
<reasoning>봇에 대한 직접 언급</reasoning>
<decision>답변</decision>
</example>
<example>
<conversation>A: 나 시험 망했어 / B: 에이 괜찮아 / A: ㅠㅠ 고마워</conversation>
<reasoning>B가 이미 잘 위로해줬고 대화가 마무리되는 중</reasoning>
<decision><SKIP></decision>
</example>
</examples>`;

function getJudgePrompt(): string {
  return state.config.judgePrompt || DEFAULT_JUDGE_PROMPT;
}

export async function judgeAndReply(history: HistoryMessage[], ragContext: string = "", userId: string = ""): Promise<string | null> {
  const basePrompt = buildPromptWithCustom(userId);
  const parts = [`<persona>\n${basePrompt}\n</persona>`];
  if (ragContext) parts.push(`<memory>\n${ragContext}\n</memory>`);
  parts.push(`<task>\n${getJudgePrompt()}\n</task>`);
  const reply = await callAI(history, parts.join("\n\n"));
  if (reply.trim() === "<SKIP>") return null;
  return reply;
}

export async function callAI(history: HistoryMessage[], prompt: string): Promise<string> {
  const provider = state.config.aiProvider;
  const model = state.config.model;
  lastUsedModel = model;

  try {
    switch (provider) {
      case "anthropic":
        return await getAnthropicReply(history, prompt, model);
      case "openai":
        return await getOpenAIReply(history, prompt, model);
      case "google":
        return await getGoogleReply(history, prompt, model);
      case "codex":
        return await getCodexReply(history, prompt, model);
      default:
        throw new Error(`지원하지 않는 AI_PROVIDER: ${provider}`);
    }
  } catch (err) {
    const msg = (err as Error).message || "";
    const isRetryable = msg.includes("429") || msg.includes("quota") || msg.includes("limit") || msg.includes("500") || msg.includes("503") || msg.includes("overloaded");

    if (!isRetryable || model === FALLBACK_MODEL) throw err;

    console.warn(`[AI Fallback] ${provider}/${model} 실패 (${msg.slice(0, 80)}), ${FALLBACK_MODEL}로 재시도`);
    addEvent("ai_fallback", `${provider}/${model} → ${FALLBACK_MODEL}`);

    lastUsedModel = FALLBACK_MODEL;
    return await getGoogleReply(history, prompt, FALLBACK_MODEL);
  }
}

async function getAnthropicReply(history: HistoryMessage[], prompt: string, model: string): Promise<string> {
  const apiKey = state.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API 키가 설정되지 않았습니다. Settings → API Keys에서 설정하세요.");
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: prompt,
    messages: history,
  });
  return response.content[0].text;
}

async function getOpenAIReply(history: HistoryMessage[], prompt: string, model: string): Promise<string> {
  const apiKey = state.config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다. Settings → API Keys에서 설정하세요.");
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });
  const messages = [
    { role: "system" as const, content: prompt },
    ...history,
  ];
  const response = await client.chat.completions.create({
    model: model || "gpt-4o",
    max_tokens: 512,
    messages,
  });
  return response.choices[0].message.content;
}

async function getGoogleReply(history: HistoryMessage[], prompt: string, model: string): Promise<string> {
  const apiKey = state.config.googleApiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Google API 키가 설정되지 않았습니다. Settings → API Keys에서 설정하세요.");
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const isGemma = (model || "").startsWith("gemma");

  // Gemma doesn't support systemInstruction, inject prompt as first user message instead
  const m = genAI.getGenerativeModel({
    model: model || "gemini-2.5-flash-lite",
    ...(isGemma ? {} : { systemInstruction: prompt }),
  });

  const contents = [
    ...(isGemma ? [{ role: "user" as const, parts: [{ text: `[시스템 지시]\n${prompt}\n\n위 지시를 따라서 아래 대화에 응답해.` }] }, { role: "model" as const, parts: [{ text: "알겠어." }] }] : []),
    ...history.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [
        { text: msg.content },
        ...(msg.imageData ? [{ inlineData: { mimeType: msg.imageData.mimeType, data: msg.imageData.data } }] : []),
      ],
    })),
  ];

  const result = await m.generateContent({ contents });
  return result.response.text();
}

console.log(`AI: ${state.config.aiProvider} / ${state.config.model}`);
