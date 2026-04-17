export interface SearchResult {
  id: string;
  text: string;
  channel: string;
  timestamp: number;
  score: number;
}

export interface VectorItem {
  id: string;
  channel: string;
  timestamp: number;
  text: string;
  messageCount: number;
  hits: number;
  lastHit: number | null;
}

const DISABLED_MESSAGE = "RAG 비활성화됨";

export async function initIndex(): Promise<void> {
  console.log(DISABLED_MESSAGE);
}

export async function storeConversation(_params: {
  channel: string;
  messages: { content: string }[];
  timestamp: number;
}): Promise<void> {
  return;
}

export async function searchRelevant(_query: string, _topK: number = 3): Promise<SearchResult[]> {
  return [];
}

export function formatContext(_results: SearchResult[]): string {
  return "";
}

export async function getStats(): Promise<{ vectorCount: number; indexCreated: boolean }> {
  return { vectorCount: 0, indexCreated: false };
}

export async function listVectors(): Promise<VectorItem[]> {
  return [];
}
