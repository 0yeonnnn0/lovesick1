import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lovesick 사용 가이드"),

  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("봇 프리셋 관리")
    .addSubcommand(sub =>
      sub.setName("list").setDescription("프리셋 목록 보기")
    )
    .addSubcommand(sub =>
      sub.setName("set").setDescription("프리셋 변경")
        .addStringOption(opt =>
          opt.setName("preset").setDescription("적용할 프리셋").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("current").setDescription("현재 프리셋 확인")
    ),

  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("봇에게 질문하기")
    .addStringOption(opt =>
      opt.setName("message").setDescription("메시지 내용").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("봇 상태 확인"),

  new SlashCommandBuilder()
    .setName("summary")
    .setDescription("최근 대화 AI 요약")
    .addIntegerOption(opt =>
      opt.setName("count").setDescription("요약할 메시지 수 (기본 50)").setMinValue(10).setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("memory")
    .setDescription("저장된 기억 조회")
    .addStringOption(opt =>
      opt.setName("scope").setDescription("조회 범위")
        .addChoices(
          { name: "이 방", value: "room" },
          { name: "특정 유저", value: "user" },
          { name: "관계 기억", value: "relationship" },
        )
    )
    .addUserOption(opt =>
      opt.setName("user").setDescription("유저 지정 (선택)")
    ),

  new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("이 방의 약속/이벤트 조회"),

  new SlashCommandBuilder()
    .setName("forget")
    .setDescription("저장된 기억 삭제")
    .addStringOption(opt =>
      opt.setName("id").setDescription("삭제할 기억 ID").setRequired(true)
    ),
];
