import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMemoryStoreForTests,
  addPhotoMemory,
  addRelationshipMemory,
  addSharedMemory,
  addUserMemory,
  getMemoryStats,
  listPhotoMemories,
  listRelationshipMemories,
  listSharedMemories,
  listUserMemories,
} from "./memory";

describe("memory dedupe", () => {
  beforeEach(() => {
    __resetMemoryStoreForTests();
  });

  it("dedupes similar user memories", () => {
    addUserMemory({
      roomId: "room-1",
      userId: "user-1",
      displayName: "A",
      category: "preference",
      content: "재즈 좋아함",
      confidence: 0.5,
    });

    addUserMemory({
      roomId: "room-1",
      userId: "user-1",
      displayName: "A",
      category: "preference",
      content: "재즈 좋아함!!",
      confidence: 0.9,
    });

    const items = listUserMemories("room-1", "user-1");
    expect(items).toHaveLength(1);
    expect(items[0].confidence).toBe(0.9);
  });

  it("dedupes similar shared memories and merges tags", () => {
    addSharedMemory({
      roomId: "room-1",
      kind: "event",
      content: "토요일 7시에 성수에서 보자",
      relatedUserIds: ["u1"],
      tags: ["토요일"],
      confidence: 0.4,
    });

    addSharedMemory({
      roomId: "room-1",
      kind: "event",
      content: "토요일 7시에 성수에서 보자!",
      relatedUserIds: ["u2"],
      tags: ["성수"],
      confidence: 0.8,
    });

    const items = listSharedMemories("room-1");
    expect(items).toHaveLength(1);
    expect(items[0].tags.sort()).toEqual(["성수", "토요일"]);
    expect(items[0].relatedUserIds.sort()).toEqual(["u1", "u2"]);
  });

  it("dedupes relationship memories regardless of user order", () => {
    addRelationshipMemory({
      roomId: "room-1",
      userA: "u1",
      userB: "u2",
      kind: "tease",
      content: "u1이 u2를 자주 놀림",
      confidence: 0.6,
    });

    addRelationshipMemory({
      roomId: "room-1",
      userA: "u2",
      userB: "u1",
      kind: "tease",
      content: "u1이 u2를 자주 놀림!",
      confidence: 0.7,
    });

    expect(listRelationshipMemories("room-1")).toHaveLength(1);
  });

  it("dedupes photo memories by message id or url", () => {
    addPhotoMemory({
      roomId: "room-1",
      messageId: "m1",
      authorId: "u1",
      url: "https://example.com/a.png",
      summary: "고양이 사진",
      tags: ["고양이"],
    });

    addPhotoMemory({
      roomId: "room-1",
      messageId: "m1",
      authorId: "u1",
      url: "https://example.com/a.png",
      summary: "고양이 사진 2",
      tags: ["동물"],
    });

    expect(listPhotoMemories("room-1")).toHaveLength(1);
    expect(getMemoryStats().photos).toBe(1);
  });
});
