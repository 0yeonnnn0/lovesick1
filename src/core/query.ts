import { listEvents } from "./events";
import { listPhotoMemories, listRelationshipMemories, listSharedMemories, listUserMemories } from "./memory";

const QUERY_HINTS = [
  "언제",
  "어디",
  "누구",
  "뭐였",
  "기억",
  "약속",
  "찾아",
  "뭐지",
  "뭐더라",
  "알아",
  "말했",
  "공유한",
  "사진",
];

export function looksLikeMemoryQuery(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return QUERY_HINTS.some((hint) => normalized.includes(hint));
}

export function buildRoomMemoryContext(roomId: string, userId?: string): string {
  const userMemories = listUserMemories(roomId, userId).slice(0, 6);
  const sharedMemories = listSharedMemories(roomId).slice(0, 6);
  const relationships = userId ? listRelationshipMemories(roomId, userId).slice(0, 4) : [];
  const events = listEvents(roomId).slice(0, 6);
  const photos = listPhotoMemories(roomId).slice(0, 4);

  const sections: string[] = [];

  if (userMemories.length > 0) {
    sections.push(
      `<user_memories>\n${userMemories.map((item) => `- ${item.displayName}: ${item.content}`).join("\n")}\n</user_memories>`
    );
  }

  if (sharedMemories.length > 0) {
    sections.push(
      `<shared_memories>\n${sharedMemories.map((item) => `- [${item.kind}] ${item.content}`).join("\n")}\n</shared_memories>`
    );
  }

  if (relationships.length > 0) {
    sections.push(
      `<relationship_memories>\n${relationships.map((item) => `- ${item.content}`).join("\n")}\n</relationship_memories>`
    );
  }

  if (events.length > 0) {
    sections.push(
      `<events>\n${events.map((item) => `- [${item.status}] ${item.title}${item.timeText ? ` | 시간: ${item.timeText}` : ""}${item.locationText ? ` | 장소: ${item.locationText}` : ""}`).join("\n")}\n</events>`
    );
  }

  if (photos.length > 0) {
    sections.push(
      `<photos>\n${photos.map((item) => `- ${item.summary} | tags: ${item.tags.join(", ") || "none"} | url: ${item.url}`).join("\n")}\n</photos>`
    );
  }

  return sections.join("\n\n");
}
