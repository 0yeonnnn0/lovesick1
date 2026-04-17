import {
  ChatInputCommandInteraction,
  REST,
  Routes,
} from "discord.js";
import { commands } from "./definitions";
import { handleQuestion, handleSummary } from "./chat";
import { handleMemory, handleSchedule, handleForget } from "./memory";
import { handleHelp, handleStatus } from "./settings";

export { commands } from "./definitions";
export { isChannelMuted } from "./mute";

// ── Register Commands ──
export async function registerCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("슬래시 커맨드 등록 중...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map(c => c.toJSON()),
    });
    console.log("슬래시 커맨드 등록 완료");
  } catch (err) {
    console.error("슬래시 커맨드 등록 실패:", (err as Error).message);
  }
}

// ── Handle Interactions ──
export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName } = interaction;

  switch (commandName) {
    case "help":
      await handleHelp(interaction);
      break;
    case "ask":
      await handleQuestion(interaction);
      break;
    case "status":
      await handleStatus(interaction);
      break;
    case "summary":
      await handleSummary(interaction);
      break;
    case "memory":
      await handleMemory(interaction);
      break;
    case "schedule":
      await handleSchedule(interaction);
      break;
    case "forget":
      await handleForget(interaction);
      break;
  }
}

// ── Autocomplete ──
export async function handleAutocomplete(interaction: any): Promise<void> {
  await interaction.respond([]);
}
