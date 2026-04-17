import { addEventRecord, listEvents } from "./events";
import {
  addRelationshipMemory,
  addSharedMemory,
  addUserMemory,
  hasSimilarRelationshipMemory,
  hasSimilarSharedMemory,
  hasSimilarUserMemory,
} from "./memory";
import type { AIExtractionResult, EventStatus } from "./types";

interface ExtractInput {
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  messageId?: string;
}

const PREFERENCE_PATTERNS = [
  /(.+?) 좋아해/,
  /(.+?) 좋아함/,
  /(.+?) 싫어해/,
  /(.+?) 싫어함/,
  /(.+?) 자주 해/,
];

const STATUS_PATTERNS = [
  /요즘 (.+)/,
  /이번 주 (.+)/,
  /오늘 (.+)/,
];

const EVENT_PATTERNS = [
  /(토요일|일요일|월요일|화요일|수요일|목요일|금요일|내일|모레|다음 주|이번 주).*(보자|보기로|만나자|가자|먹자)/,
  /(\d{1,2}시).*(보자|만나자|출발|약속)/,
  /(성수|강남|홍대|잠실|판교|집).*(보자|가자|만나자)/,
];

function normalize(content: string): string {
  return content.replace(/<@!?\d+>/g, "").trim();
}

function alreadyHasRecentFact(roomId: string, userId: string, content: string): boolean {
  return hasSimilarUserMemory(roomId, userId, content);
}

function detectPreference(content: string): string | null {
  for (const pattern of PREFERENCE_PATTERNS) {
    const match = content.match(pattern);
    if (match) return `${match[1].trim()} 관련 취향 언급`;
  }
  return null;
}

function detectStatus(content: string): string | null {
  for (const pattern of STATUS_PATTERNS) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function detectEvent(content: string): { title: string; description: string; timeText?: string; locationText?: string; status: EventStatus } | null {
  if (!EVENT_PATTERNS.some((pattern) => pattern.test(content))) return null;
  const timeMatch = content.match(/(토요일|일요일|월요일|화요일|수요일|목요일|금요일|내일|모레|다음 주|이번 주|\d{1,2}시[^ ]*)/);
  const locationMatch = content.match(/(성수|강남|홍대|잠실|판교|집|카페|술집|식당)/);
  return {
    title: content.length > 40 ? `${content.slice(0, 37)}...` : content,
    description: content,
    timeText: timeMatch?.[1],
    locationText: locationMatch?.[1],
    status: "proposed",
  };
}

export function extractMemoriesFromMessage(input: ExtractInput): void {
  const content = normalize(input.content);
  if (!content || content.length < 3) return;

  if (!alreadyHasRecentFact(input.roomId, input.userId, content)) {
    const preference = detectPreference(content);
    if (preference) {
      addUserMemory({
        roomId: input.roomId,
        userId: input.userId,
        displayName: input.displayName,
        category: "preference",
        content: preference,
        confidence: 0.55,
      });
    }

    const status = detectStatus(content);
    if (status) {
      addUserMemory({
        roomId: input.roomId,
        userId: input.userId,
        displayName: input.displayName,
        category: "status",
        content: status,
        confidence: 0.45,
      });
    }
  }

  const event = detectEvent(content);
  if (event) {
    const exists = listEvents(input.roomId).some((item) => item.description === event.description);
    if (!exists) {
      addEventRecord({
        roomId: input.roomId,
        title: event.title,
        description: event.description,
        participants: [input.userId],
        status: event.status,
        timeText: event.timeText,
        locationText: event.locationText,
        sourceMessageId: input.messageId,
      });
      addSharedMemory({
        roomId: input.roomId,
        kind: "event",
        content: event.description,
        relatedUserIds: [input.userId],
        tags: [event.timeText, event.locationText].filter(Boolean) as string[],
        confidence: 0.65,
      });
    }
  }
}

interface ApplyAIExtractionInput {
  roomId: string;
  defaultUserId: string;
  defaultDisplayName: string;
  displayNameToUserId?: Record<string, string>;
  result: AIExtractionResult;
  messageId?: string;
}

function hasUserMemory(roomId: string, content: string): boolean {
  return hasSimilarUserMemory(roomId, "", content);
}

function resolveUserId(
  rawName: string | undefined,
  mapping: Record<string, string> | undefined,
  fallbackUserId: string,
  fallbackDisplayName: string,
): { userId: string; displayName: string } {
  if (!rawName) return { userId: fallbackUserId, displayName: fallbackDisplayName };
  if (mapping?.[rawName]) return { userId: mapping[rawName], displayName: rawName };
  return { userId: fallbackUserId, displayName: rawName || fallbackDisplayName };
}

export function applyAIExtraction(input: ApplyAIExtractionInput): void {
  const { roomId, defaultUserId, defaultDisplayName, displayNameToUserId, result, messageId } = input;

  for (const item of result.userMemories) {
    if (!item.content || hasSimilarUserMemory(roomId, defaultUserId, item.content, item.category)) continue;
    addUserMemory({
      roomId,
      userId: defaultUserId,
      displayName: defaultDisplayName,
      category: item.category,
      content: item.content,
      confidence: item.confidence ?? 0.65,
    });
  }

  for (const item of result.sharedMemories) {
    if (!item.content || hasSimilarSharedMemory(roomId, item.content, item.kind)) continue;
    addSharedMemory({
      roomId,
      kind: item.kind,
      content: item.content,
      relatedUserIds: (item.relatedUserIds || []).map((name) => resolveUserId(name, displayNameToUserId, defaultUserId, defaultDisplayName).userId),
      tags: item.tags || [],
      confidence: item.confidence ?? 0.65,
    });
  }

  for (const item of result.relationshipMemories) {
    if (!item.content) continue;
    const a = resolveUserId(item.userA, displayNameToUserId, defaultUserId, defaultDisplayName);
    const b = resolveUserId(item.userB, displayNameToUserId, defaultUserId, defaultDisplayName);
    if (hasSimilarRelationshipMemory(roomId, a.userId, b.userId, item.content, item.kind)) continue;
    addRelationshipMemory({
      roomId,
      userA: a.userId,
      userB: b.userId,
      kind: item.kind,
      content: item.content,
      confidence: item.confidence ?? 0.6,
    });
  }

  for (const item of result.events) {
    if (!item.description) continue;
    const exists = listEvents(roomId).some((event) => event.description === item.description);
    if (exists) continue;
    addEventRecord({
      roomId,
      title: item.title || item.description.slice(0, 40),
      description: item.description,
      participants: (item.participants || [defaultDisplayName]).map((name) => resolveUserId(name, displayNameToUserId, defaultUserId, defaultDisplayName).userId),
      status: item.status || "proposed",
      timeText: item.timeText,
      locationText: item.locationText,
      sourceMessageId: messageId,
    });
  }
}
