export type MemoryCategory = "fact" | "preference" | "status" | "joke";
export type SharedMemoryKind = "event" | "joke" | "place" | "photo" | "summary";
export type RelationshipKind = "close" | "tease" | "game" | "schedule" | "conflict";
export type EventStatus = "proposed" | "confirmed" | "done" | "canceled";

export interface UserMemory {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface SharedMemory {
  id: string;
  roomId: string;
  kind: SharedMemoryKind;
  content: string;
  relatedUserIds: string[];
  tags: string[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipMemory {
  id: string;
  roomId: string;
  userA: string;
  userB: string;
  kind: RelationshipKind;
  content: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface PhotoMemory {
  id: string;
  roomId: string;
  messageId: string;
  authorId: string;
  url: string;
  summary: string;
  tags: string[];
  relatedEventId?: string;
  createdAt: number;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  title: string;
  description: string;
  participants: string[];
  status: EventStatus;
  timeText?: string;
  locationText?: string;
  sourceMessageId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryStore {
  users: UserMemory[];
  shared: SharedMemory[];
  relationships: RelationshipMemory[];
  photos: PhotoMemory[];
}

export interface AIExtractedUserMemory {
  category: MemoryCategory;
  content: string;
  confidence?: number;
}

export interface AIExtractedSharedMemory {
  kind: SharedMemoryKind;
  content: string;
  relatedUserIds?: string[];
  tags?: string[];
  confidence?: number;
}

export interface AIExtractedRelationshipMemory {
  kind: RelationshipKind;
  content: string;
  userA?: string;
  userB?: string;
  confidence?: number;
}

export interface AIExtractedEvent {
  title: string;
  description: string;
  status?: EventStatus;
  timeText?: string;
  locationText?: string;
  participants?: string[];
}

export interface AIExtractionResult {
  userMemories: AIExtractedUserMemory[];
  sharedMemories: AIExtractedSharedMemory[];
  relationshipMemories: AIExtractedRelationshipMemory[];
  events: AIExtractedEvent[];
}
