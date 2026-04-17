import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HistoryMessage } from "./history";

const execFileAsync = promisify(execFile);

type ExecFileError = NodeJS.ErrnoException & {
  stderr?: string;
  stdout?: string;
  path?: string;
};

function formatHistory(history: HistoryMessage[]): string {
  return history.map((message, index) => {
    const role = message.role === "assistant" ? "assistant" : "user";
    const imageNote = message.imageData ? "\n[image attachment omitted for codex exec provider]" : "";
    return `<message index="${index + 1}" role="${role}">\n${message.content}${imageNote}\n</message>`;
  }).join("\n");
}

function buildCodexPrompt(history: HistoryMessage[], systemPrompt: string): string {
  return [
    "You are being used as the runtime for a Discord shared-memory assistant.",
    "Do not inspect repository files, do not browse the project, and do not run shell commands.",
    "Treat this as a pure text-generation task based only on the provided system prompt and conversation.",
    "Return only the final reply for the user. Do not explain your process.",
    "",
    "<system_prompt>",
    systemPrompt,
    "</system_prompt>",
    "",
    "<conversation>",
    formatHistory(history),
    "</conversation>",
  ].join("\n");
}

function extractCodexReplyFromTranscript(stdout: string): string {
  const text = stdout.trim();
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== "codex") continue;

    const collected: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();
      if (!trimmed) {
        if (collected.length > 0) break;
        continue;
      }
      if (/^(tokens used|warning:|user|approval:|sandbox:|session id:|model:|provider:|workdir:|-{2,})/i.test(trimmed)) {
        if (collected.length > 0) break;
        continue;
      }
      collected.push(line);
    }

    const reply = collected.join("\n").trim();
    if (reply) return reply;
  }

  return "";
}

function extractCodexReplyFromJsonLines(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const event = JSON.parse(lines[index]) as {
        type?: string;
        item?: { type?: string; text?: string };
      };
      if (event.type !== "item.completed") continue;
      if (event.item?.type !== "agent_message") continue;
      const text = event.item.text?.trim();
      if (text) return text;
    } catch {
      continue;
    }
  }

  return "";
}

function extractCodexErrorMessage(error: unknown, codexBin: string): string {
  const err = error as ExecFileError;
  if (err.code === "ENOENT" && (err.path === codexBin || err.message.includes(codexBin))) {
    return "Codex CLI를 찾을 수 없습니다. `codex`를 설치하거나 `CODEX_BIN` 경로를 설정하세요.";
  }

  const stderr = `${err.stderr || ""}\n${err.stdout || ""}`.trim();
  if (/auth|login|sign in|credential|token/i.test(stderr)) {
    return "Codex 인증이 필요합니다. 서버에서 `codex login`으로 로그인한 뒤 다시 시도하세요.";
  }

  return stderr || err.message || "Codex 실행에 실패했습니다.";
}

export const __test = {
  extractCodexReplyFromJsonLines,
  extractCodexReplyFromTranscript,
  extractCodexErrorMessage,
};

export async function getCodexReply(history: HistoryMessage[], systemPrompt: string, model: string): Promise<string> {
  const codexBin = process.env.CODEX_BIN || "codex";
  const prompt = buildCodexPrompt(history, systemPrompt);
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--json",
    "--model",
    model || "gpt-5.4",
    "--ephemeral",
    prompt,
  ];

  try {
    const { stdout, stderr } = await execFileAsync(codexBin, args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 4,
      timeout: 120_000,
      env: process.env,
    });

    const combined = `${stdout}\n${stderr}`;
    const reply = extractCodexReplyFromJsonLines(combined) || extractCodexReplyFromTranscript(combined);
    if (!reply) {
      throw new Error("Codex 응답이 비어 있습니다.");
    }
    return reply;
  } catch (error) {
    throw new Error(extractCodexErrorMessage(error, codexBin));
  }
}
