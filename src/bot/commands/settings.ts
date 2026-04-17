import type { ChatInputCommandInteraction } from "discord.js";
import { getPresets, setActivePreset, getActivePresetId, getPreset } from "../prompt";
import { state } from "../../shared/state";
import { getQueueStats } from "../queue";
import { getStats as getRagStats } from "../rag";
import { getVaultStats } from "../vault";
import { getEventStats } from "../../core/events";
import { getMemoryStats } from "../../core/memory";

// ── /help ──
export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = {
    color: 0x3182f6,
    title: "Lovesick 사용 가이드",
    fields: [
      {
        name: "💬 대화",
        value: [
          "`@봇 멘션` — 멘션하면 답변",
          "`/ask` — 기억 기반 질문",
          "`/summary` — 최근 대화 요약",
          "`/mode` — 응답 톤 프리셋 변경",
        ].join("\n"),
      },
      {
        name: "🧠 기억",
        value: [
          "`/memory` — 저장된 기억 조회",
          "`/schedule` — 이 방의 약속/이벤트 조회",
          "`/forget` — 잘못 저장된 기억 삭제",
        ].join("\n"),
      },
      {
        name: "⚙️ 운영",
        value: [
          "`/status` — 봇 상태 확인",
          "`/mode` — 현재 캐릭터/톤 확인 및 변경",
        ].join("\n"),
      },
    ],
  };

  await interaction.reply({ embeds: [embed] });
}

// ── /mode ──
export async function handleMode(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    const presets = getPresets(true);
    const list = presets.map(p =>
      `${p.active ? "▸ " : "　"}**${p.name}**${p.active ? " ← current" : ""}\n　　\`/mode set preset:${p.id}\``
    ).join("\n");
    await interaction.reply({ content: `**프리셋**\n\n${list}`, ephemeral: true });
    return;
  }

  if (sub === "current") {
    const id = getActivePresetId();
    const preset = getPreset(id);
    await interaction.reply({
      content: `Current preset: **${preset?.name || id}**\n\`${id}\``,
      ephemeral: true,
    });
    return;
  }

  if (sub === "set") {
    const presetId = interaction.options.getString("preset", true);
    const presets = getPresets();
    const found = presets.find(p => p.id === presetId || p.name.includes(presetId));

    if (!found) {
      await interaction.reply({ content: `\`${presetId}\` 프리셋을 찾을 수 없어`, ephemeral: true });
      return;
    }

    setActivePreset(found.id);
    await interaction.reply(`프리셋 변경됨: **${found.name}**`);
  }
}

// ── /status ──
export async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const uptime = Date.now() - state.stats.startedAt;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);
  const queue = getQueueStats();
  const rag = await getRagStats();
  const memory = getMemoryStats();
  const events = getEventStats();
  const presetId = getActivePresetId();
  const preset = getPreset(presetId);

  const embed = {
    color: 0x6c8aff,
    title: "Lovesick Bot Status",
    fields: [
      { name: "Uptime", value: `${h}h ${m}m`, inline: true },
      { name: "Messages", value: `${state.stats.messagesProcessed}`, inline: true },
      { name: "Replies", value: `${state.stats.repliesSent}`, inline: true },
      { name: "Model", value: state.config.model, inline: true },
      { name: "Preset", value: preset?.name || presetId, inline: true },
      { name: "Queue", value: `${queue.activeCount}/${queue.maxConcurrent} active`, inline: true },
      { name: "RAG Vectors", value: `${rag.vectorCount}`, inline: true },
      { name: "Vault Notes", value: `${getVaultStats().userNotes}`, inline: true },
      { name: "Memories", value: `U:${memory.users} S:${memory.shared} R:${memory.relationships}`, inline: true },
      { name: "Events", value: `${events.active}/${events.total} active`, inline: true },
    ],
  };

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
