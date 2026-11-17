// Scene presence, framework-free: who else stands in this viewer's room of a shared scene, and how many NPC ants make way
// for them.
import type { AntServerEvent, ChatMessageEvent, PlazaPeer, PresenceScene } from "./chat-types";
import type { WorldScene } from "./world";

/** Scenes where viewers see each other's ants; each has its own rooms (the theater replays the past, so it has none). */
export const PRESENCE_SCENES = ["plaza", "battle"] as const satisfies readonly PresenceScene[];
export const presenceScene = (scene: WorldScene): PresenceScene | null =>
  (PRESENCE_SCENES as readonly string[]).includes(scene) ? scene as PresenceScene : null;

/** Real ants per room, as the chat hub caps it (chat-edge/src/plaza-rooms.ts PLAZA_ROOM_SIZE). */
export const PLAZA_ROOM_SIZE = 20;
/** Rooms a viewer may type in: shown 1..PLAZA_ROOM_LIMIT, 0-based on the wire. */
export const PLAZA_ROOM_LIMIT = 999;

/** NPC ants kept beside `peers` other viewers (plaza crowd and battle camps alike): one fewer for every two peers, never below half the base crowd. */
export const fakeCapacity = (base: number, peers: number): number =>
  Math.max(Math.ceil(base / 2), base - Math.floor(Math.max(0, peers) / 2));

/** The room number a viewer typed (1-based), as the 0-based wire value; null when it is not a room. */
export const parseRoomInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const shown = Number(trimmed);
  return shown >= 1 && shown <= PLAZA_ROOM_LIMIT ? shown - 1 : null;
};

export type PresenceState = { room: number | null; self: string | null; peers: Map<string, PlazaPeer> };

export const emptyPresence = (): PresenceState => ({ room: null, self: null, peers: new Map() });

/** Applies one hub event; returns true when the room or its peers changed. */
export function applyPresenceEvent(state: PresenceState, event: AntServerEvent | ChatMessageEvent): boolean {
  switch (event.type) {
    case "ant.error":
      return false;
    case "ant.room":
      state.room = event.room;
      state.self = event.self;
      state.peers = new Map(event.peers.map((peer) => [peer.id, { ...peer }]));
      return true;
    case "ant.join":
      state.peers.set(event.ant.id, { ...event.ant });
      return true;
    case "ant.move": {
      const peer = state.peers.get(event.id);
      if (!peer) return false;
      peer.x = event.x;
      peer.z = event.z;
      return true;
    }
    case "ant.leave":
      return state.peers.delete(event.id);
    case "chat.message": {
      // A guest may change nickname with any message; the tag follows it.
      const peer = event.ant_id ? state.peers.get(event.ant_id) : undefined;
      if (!peer || peer.name === event.message.author_name) return false;
      peer.name = event.message.author_name;
      return true;
    }
  }
}
