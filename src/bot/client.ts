import { Client, GatewayIntentBits, Message, ChatInputCommandInteraction } from "discord.js";
import { getReply } from "./ai";
import { state, addEvent, addError } from "../shared/state";
import { registerCommands, handleInteraction, handleAutocomplete } from "./commands";
import { setupMessageHandler } from "./message-handler";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Events ──
client.once("ready", async () => {
  console.log(`봇 로그인 완료: ${client.user!.tag}`);
  addEvent("bot_ready", `${client.user!.tag} — ${client.guilds.cache.size}개 서버`);

  // 슬래시 커맨드 등록
  await registerCommands(client.user!.id, process.env.DISCORD_TOKEN || "");
});

// 슬래시 커맨드 핸들러
client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }
  if (interaction.isChatInputCommand()) {
    await handleInteraction(interaction as ChatInputCommandInteraction);
    return;
  }
});

client.on("guildCreate", (guild) => addEvent("guild_join", `${guild.name} (${guild.memberCount}명)`));

// ── 환영 메시지 ──
client.on("guildMemberAdd", async (member) => {
  addEvent("member_join", `${member.user.tag} → ${member.guild.name}`);

  // 시스템 채널 (서버 설정에서 지정한 환영 채널)
  const channel = member.guild.systemChannel;
  if (!channel) return;

  try {
    const history = [{
      role: "user" as const,
      content: `새로운 멤버 "${member.user.displayName}"이(가) 서버에 들어왔어. 환영 인사를 해줘. 짧게.`,
    }];
    const reply = await getReply(history, "", "");
    await channel.send(`${member} ${reply}\n필요하면 \`/help\` 로 사용법을 볼 수 있어.`);
  } catch {
    await channel.send(`${member} 어서 와. 필요하면 \`/help\` 로 사용법을 확인해.`).catch(() => {});
  }
});
client.on("guildDelete", (guild) => addEvent("guild_leave", guild.name));
client.on("error", (err) => addError("discord", err.message));
client.on("warn", (msg) => addEvent("discord_warn", msg));

// 메시지 핸들러 등록
setupMessageHandler(client);

// ── DEBUG: 모든 봇 메시지 전송 추적 ──
client.on("messageCreate", (msg) => {
  if (msg.author.id === client.user?.id) {
    const ref = msg.reference?.messageId || "none";
    console.log(`[BOT:SENT] content="${msg.content.slice(0, 60)}" replyTo=${ref} channel=${(msg.channel as any).name || msg.channel.id}`);
  }
});

export async function start(): Promise<void> {
  addEvent("bot_start", "봇 프로세스 시작");
  await client.login(process.env.DISCORD_TOKEN);
}
