import fs from "fs";
import path from "path";
import type { EventStatus, RoomEvent } from "./types";

const DATA_DIR = path.join(__dirname, "../../data/events");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

let events: RoomEvent[] = loadEvents();

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function loadEvents(): RoomEvent[] {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8")) as RoomEvent[];
  } catch {
    return [];
  }
}

function saveEvents(): void {
  if (isTestEnv()) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
}

function makeId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listEvents(roomId: string, status?: EventStatus): RoomEvent[] {
  return events
    .filter((event) => event.roomId === roomId && (!status || event.status === status))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addEventRecord(entry: Omit<RoomEvent, "id" | "createdAt" | "updatedAt">): RoomEvent {
  const now = Date.now();
  const created: RoomEvent = {
    ...entry,
    id: makeId(),
    createdAt: now,
    updatedAt: now,
  };
  events.push(created);
  saveEvents();
  return created;
}

export function updateEventStatus(id: string, status: EventStatus): RoomEvent | null {
  const found = events.find((event) => event.id === id);
  if (!found) return null;
  found.status = status;
  found.updatedAt = Date.now();
  saveEvents();
  return found;
}

export function getEventStats(): { total: number; active: number } {
  return {
    total: events.length,
    active: events.filter((event) => event.status === "proposed" || event.status === "confirmed").length,
  };
}

export function __resetEventsForTests(): void {
  events = [];
}
