import { ChatInputCommandInteraction, TextChannel, ChannelType } from "discord.js";
import { answerMemoryQuery, getReply } from "../ai";
import { buildRoomMemoryContext, looksLikeMemoryQuery } from "../../core/query";
import * as historyStore from "../history";
import * as rag from "../rag";
import { addError } from "../../shared/state";

// ── /ask ──
export async function handleQuestion(interaction: ChatInputCommandInteraction): Promise<void> {
  const message = interaction.options.getString("message", true);
  console.log(`[ASK:START] user=${interaction.user.displayName} channel=${interaction.channelId} message="${message.slice(0, 120)}"`);
  await interaction.deferReply();

  try {
    const roomId = interaction.channelId;
    const chatHistory = historyStore.getHistory(roomId).slice(-12);
    chatHistory.push({ role: "user" as const, content: `${interaction.user.displayName}: ${message}` });
    console.log(`[ASK:HISTORY] channel=${roomId} historyCount=${chatHistory.length}`);

    const ragResults = await rag.searchRelevant(message).catch(() => []);
    const memoryContext = buildRoomMemoryContext(roomId, interaction.user.id);
    const ragContext = `${memoryContext}\n\n${rag.formatContext(ragResults)}`.trim();
    const isMemoryQuery = looksLikeMemoryQuery(message);
    console.log(
      `[ASK:CONTEXT] channel=${roomId} memoryQuery=${isMemoryQuery} memoryChars=${memoryContext.length} ragChars=${ragContext.length}`
    );

    console.log(`[ASK:AI:BEGIN] provider=${interaction.client.user ? "connected" : "unknown"} user=${interaction.user.displayName}`);
    const reply = looksLikeMemoryQuery(message)
      ? await answerMemoryQuery(chatHistory, ragContext, interaction.user.id)
      : await getReply(chatHistory, ragContext, interaction.user.id);
    console.log(`[ASK:AI:END] user=${interaction.user.displayName} replyChars=${reply?.length || 0}`);

    console.log(`[ASK:REPLY] user=${interaction.user.displayName} channel=${roomId}`);
    await interaction.editReply(reply);
    console.log(`[ASK:DONE] user=${interaction.user.displayName} channel=${roomId}`);
  } catch (err) {
    const isRateLimit = (err as Error).message?.includes("429") || (err as Error).message?.includes("quota");
    const messageText = (err as Error).message || "unknown error";
    console.error(`[ASK:CATCH] user=${interaction.user.displayName} channel=${interaction.channelId} error="${messageText}"`);
    addError("ask_command", messageText, `channel: ${interaction.channelId}, user: ${interaction.user.id}`);
    await interaction.editReply(
      isRateLimit
        ? "오늘은 너무 많이 떠들었다냥... 내일 다시 돌아온다냥! >w<"
        : "뭔가 고장났다냥... @д@ [CH]"
    );
  }
}

// ── /summary ──
export async function handleSummary(interaction: ChatInputCommandInteraction): Promise<void> {
  const count = interaction.options.getInteger("count") || 50;
  const channel = interaction.channel;

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "텍스트 채널에서만 사용 가능해", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const messages = await (channel as TextChannel).messages.fetch({ limit: count });
    const sorted = [...messages.values()]
      .filter(m => !m.author.bot)
      .reverse();

    if (sorted.length === 0) {
      await interaction.editReply("요약할 메시지가 없어");
      return;
    }

    const chatLog = sorted.map(m =>
      `${m.author.displayName}: ${m.content}`
    ).join("\n");

    const summaryPrompt = `아래 디스코드 채팅 내용을 한국어로 요약해줘.
주요 주제별로 정리하고, 누가 뭘 말했는지 간략히 포함해.
3~5개 항목으로 정리해. 이모지 쓰지 마.

---
${chatLog}`;

    const history = [{ role: "user" as const, content: summaryPrompt }];
    const reply = await getReply(history, "", interaction.user.id);

    const embed = {
      color: 0x6c8aff,
      title: `💬 최근 ${sorted.length}개 메시지 요약`,
      description: reply,
      footer: { text: `#${(channel as TextChannel).name}` },
      timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const messageText = (err as Error).message || "unknown error";
    console.error(`[SUMMARY:CATCH] user=${interaction.user.displayName} channel=${interaction.channelId} error="${messageText}"`);
    addError("summary_command", messageText, `channel: ${interaction.channelId}, user: ${interaction.user.id}`);
    await interaction.editReply("요약하다가 고장났다냥... @д@ " + messageText);
  }
}
