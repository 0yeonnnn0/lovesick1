import type { ChatInputCommandInteraction } from "discord.js";
import { listEvents } from "../../core/events";
import {
  forgetMemory,
  listRelationshipMemories,
  listSharedMemories,
  listUserMemories,
} from "../../core/memory";

function truncate(text: string, max = 1600): string {
  return text.length > max ? `${text.slice(0, max)}\n...` : text;
}

export async function handleMemory(interaction: ChatInputCommandInteraction): Promise<void> {
  const scope = interaction.options.getString("scope") || "room";
  const channelId = interaction.channelId;
  const user = interaction.options.getUser("user") || interaction.user;

  const userMemories = scope === "user"
    ? listUserMemories(channelId, user.id).slice(0, 8)
    : [];
  const sharedMemories = scope === "room"
    ? listSharedMemories(channelId).slice(0, 8)
    : [];
  const relationships = scope === "relationship"
    ? listRelationshipMemories(channelId, user.id).slice(0, 8)
    : [];

  const sections: string[] = [];

  if (userMemories.length > 0) {
    sections.push(`**${user.displayName} 기억**\n${userMemories.map((item) => `- \`${item.id}\` ${item.content}`).join("\n")}`);
  }

  if (sharedMemories.length > 0) {
    sections.push(`**이 방의 공동 기억**\n${sharedMemories.map((item) => `- \`${item.id}\` ${item.content}`).join("\n")}`);
  }

  if (relationships.length > 0) {
    sections.push(`**관계 기억**\n${relationships.map((item) => `- \`${item.id}\` ${item.content}`).join("\n")}`);
  }

  if (sections.length === 0) {
    await interaction.reply({
      content: "아직 저장된 기억이 없어. 이제부터 shared memory 구조를 채우면 여기서 조회할 수 있게 된다.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: truncate(sections.join("\n\n")),
    ephemeral: true,
  });
}

export async function handleSchedule(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const active = listEvents(channelId).slice(0, 10);

  if (active.length === 0) {
    await interaction.reply({
      content: "이 방에 저장된 약속이 아직 없어.",
      ephemeral: true,
    });
    return;
  }

  const lines = active.map((event) => {
    const when = event.timeText ? ` | 시간: ${event.timeText}` : "";
    const where = event.locationText ? ` | 장소: ${event.locationText}` : "";
    return `- \`${event.id}\` [${event.status}] ${event.title}${when}${where}`;
  });

  await interaction.reply({
    content: truncate(`**이 방의 약속/이벤트**\n${lines.join("\n")}`),
    ephemeral: true,
  });
}

export async function handleForget(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString("id", true);
  const deleted = forgetMemory(id);

  await interaction.reply({
    content: deleted
      ? `기억 \`${id}\` 를 삭제했어.`
      : `\`${id}\` 에 해당하는 기억을 찾지 못했어.`,
    ephemeral: true,
  });
}
