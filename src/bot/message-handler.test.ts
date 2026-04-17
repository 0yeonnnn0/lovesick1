import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ai", () => ({
  answerMemoryQuery: vi.fn(async () => "memory-reply"),
  extractMemoriesWithAI: vi.fn(async () => ({
    userMemories: [],
    sharedMemories: [],
    relationshipMemories: [],
    events: [],
  })),
  getReply: vi.fn(async () => "chat-reply"),
  judgeAndReply: vi.fn(async () => null),
  lastUsedModel: "test-model",
  summarizeImageMemory: vi.fn(async () => ({ summary: "photo summary", tags: ["photo"] })),
}));

vi.mock("./rag", () => ({
  searchRelevant: vi.fn(async () => []),
  formatContext: vi.fn(() => ""),
  storeConversation: vi.fn(),
}));

vi.mock("./queue", async () => {
  const actual = await vi.importActual<typeof import("./queue")>("./queue");
  return {
    ...actual,
    enqueue: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
});

vi.mock("./scrape", () => ({
  extractUrls: vi.fn((text: string) => {
    const matches = text.match(/https?:\/\/\S+/g);
    return matches ?? [];
  }),
  fetchUrlContext: vi.fn(async () => "shared link context"),
}));

vi.mock("./vault", () => ({
  getUserContext: vi.fn(() => ""),
  extractAndSave: vi.fn(async () => {}),
  getVaultStats: vi.fn(() => ({ userNotes: 0 })),
}));

vi.mock("./commands", () => ({
  isChannelMuted: vi.fn(() => false),
}));

import { handleIncomingMessage, __resetMessageHandlerForTests } from "./message-handler";
import { __resetHistoryForTests } from "./history";
import { __resetMemoryStoreForTests, listPhotoMemories, listSharedMemories, listUserMemories } from "../core/memory";
import { __resetEventsForTests, listEvents } from "../core/events";
import { state } from "../shared/state";
import * as ai from "./ai";

function createMessage(overrides: Partial<any> = {}): any {
  const mentionsHas = vi.fn((target: { id: string }) => target?.id === "bot-user");
  return {
    id: "msg-1",
    content: "나 요즘 재즈 좋아해",
    author: {
      id: "user-1",
      displayName: "민수",
      bot: false,
    },
    guild: {
      name: "guild-1",
      members: {
        cache: [
          {
            id: "user-1",
            displayName: "민수",
            nickname: "민수",
            user: { username: "minsu" },
          },
        ],
      },
    },
    channel: {
      id: "room-1",
      name: "general",
      sendTyping: vi.fn(async () => {}),
    },
    mentions: {
      has: mentionsHas,
    },
    attachments: {
      find: vi.fn(() => undefined),
    },
    reply: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("message handler pipeline", () => {
  beforeEach(() => {
    process.env.VITEST = "true";
    state.config.replyMode = "mute";
    state.config.passiveLogging = true;
    state.config.imageRecognition = true;
    state.stats.messagesProcessed = 0;
    state.stats.repliesSent = 0;
    __resetMessageHandlerForTests();
    __resetHistoryForTests();
    __resetMemoryStoreForTests();
    __resetEventsForTests();
    vi.clearAllMocks();
  });

  it("stores heuristic memory and event data from a normal message", async () => {
    const message = createMessage({
      content: "나 요즘 재즈 좋아해 그리고 토요일 7시에 성수에서 보자",
    });

    await handleIncomingMessage(message, { id: "bot-user" });

    expect(listUserMemories("room-1", "user-1").some((item) => item.category === "preference")).toBe(true);
    expect(listUserMemories("room-1", "user-1").some((item) => item.category === "status")).toBe(true);
    expect(listEvents("room-1")).toHaveLength(1);
    expect(listSharedMemories("room-1").some((item) => item.kind === "event")).toBe(true);
    expect(ai.extractMemoriesWithAI).toHaveBeenCalled();
  });

  it("uses memory query mode for mention questions", async () => {
    const message = createMessage({
      id: "msg-2",
      content: "<@bot-user> 우리 다음 약속 언제지?",
    });

    await handleIncomingMessage(message, { id: "bot-user" });

    expect(ai.answerMemoryQuery).toHaveBeenCalled();
    expect(ai.getReply).not.toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith("memory-reply");
  });

  it("stores photo and link memories from attachments and shared URLs", async () => {
    const message = createMessage({
      id: "msg-3",
      content: "이거 봐 https://example.com/photo",
      attachments: {
        find: vi.fn(() => ({
          url: "https://cdn.example.com/test.png",
          contentType: "image/png",
          size: 1024,
        })),
      },
    });

    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("cdn.example.com")) {
        return {
          arrayBuffer: async () => new TextEncoder().encode("img").buffer,
        } as Response;
      }
      return {
        text: async () => "",
      } as Response;
    }) as any;

    await handleIncomingMessage(message, { id: "bot-user" });

    expect(listPhotoMemories("room-1")).toHaveLength(1);
    expect(listSharedMemories("room-1").some((item) => item.kind === "photo")).toBe(true);
    expect(listSharedMemories("room-1").some((item) => item.tags.includes("link"))).toBe(true);
  });
});
