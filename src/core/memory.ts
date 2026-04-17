import fs from "fs";
import path from "path";
import type {
  MemoryStore,
  PhotoMemory,
  RelationshipMemory,
  SharedMemory,
  UserMemory,
} from "./types";

const DATA_DIR = path.join(__dirname, "../../data/memory");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const emptyStore = (): MemoryStore => ({
  users: [],
  shared: [],
  relationships: [],
  photos: [],
});

let store: MemoryStore = loadStore();

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): MemoryStore {
  try {
    if (!fs.existsSync(STORE_FILE)) return emptyStore();
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8")) as Partial<MemoryStore>;
    return {
      users: parsed.users ?? [],
      shared: parsed.shared ?? [],
      relationships: parsed.relationships ?? [],
      photos: parsed.photos ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(): void {
  if (isTestEnv()) return;
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && nb.includes(na)) return true;
  if (nb.length >= 10 && na.includes(nb)) return true;
  return false;
}

function isRecent(timestamp: number, windowMs = 1000 * 60 * 60 * 24 * 14): boolean {
  return Date.now() - timestamp <= windowMs;
}

export function getMemoryStore(): MemoryStore {
  return store;
}

export function listUserMemories(roomId: string, userId?: string): UserMemory[] {
  return store.users
    .filter((entry) => entry.roomId === roomId && (!userId || entry.userId === userId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listSharedMemories(roomId: string): SharedMemory[] {
  return store.shared
    .filter((entry) => entry.roomId === roomId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listRelationshipMemories(roomId: string, userId?: string): RelationshipMemory[] {
  return store.relationships
    .filter((entry) => {
      if (entry.roomId !== roomId) return false;
      if (!userId) return true;
      return entry.userA === userId || entry.userB === userId;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function hasSimilarUserMemory(roomId: string, userId: string, content: string, category?: UserMemory["category"]): boolean {
  return store.users.some((entry) =>
    entry.roomId === roomId &&
    entry.userId === userId &&
    (!category || entry.category === category) &&
    isRecent(entry.updatedAt) &&
    isNearDuplicate(entry.content, content)
  );
}

export function hasSimilarSharedMemory(roomId: string, content: string, kind?: SharedMemory["kind"]): boolean {
  return store.shared.some((entry) =>
    entry.roomId === roomId &&
    (!kind || entry.kind === kind) &&
    isRecent(entry.updatedAt) &&
    isNearDuplicate(entry.content, content)
  );
}

export function hasSimilarRelationshipMemory(
  roomId: string,
  userA: string,
  userB: string,
  content: string,
  kind?: RelationshipMemory["kind"],
): boolean {
  return store.relationships.some((entry) => {
    const sameUsers = (
      (entry.userA === userA && entry.userB === userB) ||
      (entry.userA === userB && entry.userB === userA)
    );
    return sameUsers &&
      entry.roomId === roomId &&
      (!kind || entry.kind === kind) &&
      isRecent(entry.updatedAt) &&
      isNearDuplicate(entry.content, content);
  });
}

export function addUserMemory(entry: Omit<UserMemory, "id" | "createdAt" | "updatedAt">): UserMemory {
  const existing = store.users.find((item) =>
    item.roomId === entry.roomId &&
    item.userId === entry.userId &&
    item.category === entry.category &&
    isNearDuplicate(item.content, entry.content)
  );
  if (existing) {
    existing.updatedAt = Date.now();
    existing.confidence = Math.max(existing.confidence, entry.confidence);
    saveStore();
    return existing;
  }
  const now = Date.now();
  const created: UserMemory = {
    ...entry,
    id: makeId("umem"),
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(created);
  saveStore();
  return created;
}

export function addSharedMemory(entry: Omit<SharedMemory, "id" | "createdAt" | "updatedAt">): SharedMemory {
  const existing = store.shared.find((item) =>
    item.roomId === entry.roomId &&
    item.kind === entry.kind &&
    isNearDuplicate(item.content, entry.content)
  );
  if (existing) {
    existing.updatedAt = Date.now();
    existing.confidence = Math.max(existing.confidence, entry.confidence);
    existing.tags = Array.from(new Set([...existing.tags, ...entry.tags]));
    existing.relatedUserIds = Array.from(new Set([...existing.relatedUserIds, ...entry.relatedUserIds]));
    saveStore();
    return existing;
  }
  const now = Date.now();
  const created: SharedMemory = {
    ...entry,
    id: makeId("smem"),
    createdAt: now,
    updatedAt: now,
  };
  store.shared.push(created);
  saveStore();
  return created;
}

export function addRelationshipMemory(entry: Omit<RelationshipMemory, "id" | "createdAt" | "updatedAt">): RelationshipMemory {
  const existing = store.relationships.find((item) => {
    const sameUsers = (
      (item.userA === entry.userA && item.userB === entry.userB) ||
      (item.userA === entry.userB && item.userB === entry.userA)
    );
    return sameUsers && item.roomId === entry.roomId && item.kind === entry.kind && isNearDuplicate(item.content, entry.content);
  });
  if (existing) {
    existing.updatedAt = Date.now();
    existing.confidence = Math.max(existing.confidence, entry.confidence);
    saveStore();
    return existing;
  }
  const now = Date.now();
  const created: RelationshipMemory = {
    ...entry,
    id: makeId("rmem"),
    createdAt: now,
    updatedAt: now,
  };
  store.relationships.push(created);
  saveStore();
  return created;
}

export function listPhotoMemories(roomId: string): PhotoMemory[] {
  return store.photos
    .filter((entry) => entry.roomId === roomId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function addPhotoMemory(entry: Omit<PhotoMemory, "id" | "createdAt">): PhotoMemory {
  const existing = store.photos.find((item) => item.roomId === entry.roomId && (item.messageId === entry.messageId || item.url === entry.url));
  if (existing) {
    return existing;
  }
  const created: PhotoMemory = {
    ...entry,
    id: makeId("pmem"),
    createdAt: Date.now(),
  };
  store.photos.push(created);
  saveStore();
  return created;
}

export function forgetMemory(id: string): boolean {
  const before = store.users.length + store.shared.length + store.relationships.length + store.photos.length;
  store.users = store.users.filter((entry) => entry.id !== id);
  store.shared = store.shared.filter((entry) => entry.id !== id);
  store.relationships = store.relationships.filter((entry) => entry.id !== id);
  store.photos = store.photos.filter((entry) => entry.id !== id);
  const after = store.users.length + store.shared.length + store.relationships.length + store.photos.length;
  if (before === after) return false;
  saveStore();
  return true;
}

export function getMemoryStats(): { users: number; shared: number; relationships: number; photos: number } {
  return {
    users: store.users.length,
    shared: store.shared.length,
    relationships: store.relationships.length,
    photos: store.photos.length,
  };
}

export function __resetMemoryStoreForTests(): void {
  store = emptyStore();
}
