import { test, expect } from "@playwright/test";
import { applyPresenceEvent, emptyPresence, fakeCapacity, parseRoomInput, presenceScene } from "../lib/world-presence";

test("every two other viewers take the place of one NPC, down to half the crowd", () => {
  expect([0, 1, 2, 3, 4, 19, 40].map((peers) => fakeCapacity(20, peers))).toEqual([20, 20, 19, 19, 18, 11, 10]);
  expect(fakeCapacity(12, 19)).toBe(6);
  // A full desktop room: 19 others, 11 NPCs and the visitor.
  expect(19 + fakeCapacity(20, 19) + 1).toBe(31);
});

test("room input is 1-based for people and 0-based on the wire", () => {
  expect(parseRoomInput("1")).toBe(0);
  expect(parseRoomInput(" 12 ")).toBe(11);
  expect(parseRoomInput("999")).toBe(998);
  for (const bad of ["", "0", "1000", "-1", "1.5", "abc"]) expect(parseRoomInput(bad)).toBeNull();
});

test("presence follows the room snapshot, joins, moves, leaves and guest renames", () => {
  const state = emptyPresence();
  expect(applyPresenceEvent(state, { type: "ant.room", room: 2, self: "me", peers: [{ id: "p1", name: "가", x: 0, z: 0 }] })).toBe(true);
  expect(state.room).toBe(2);
  applyPresenceEvent(state, { type: "ant.join", ant: { id: "p2", name: "나", x: 1, z: 1 } });
  applyPresenceEvent(state, { type: "ant.move", id: "p1", x: 3, z: 2 });
  expect(state.peers.get("p1")).toMatchObject({ x: 3, z: 2 });
  expect(applyPresenceEvent(state, { type: "ant.move", id: "ghost", x: 0, z: 0 })).toBe(false);
  const message = { id: "m", author_kind: "guest" as const, author_name: "새이름", text: "hi", sent_at: "" };
  expect(applyPresenceEvent(state, { type: "chat.message", message, ant_id: "p2" })).toBe(true);
  expect(state.peers.get("p2")?.name).toBe("새이름");
  applyPresenceEvent(state, { type: "ant.leave", id: "p1" });
  expect([...state.peers.keys()]).toEqual(["p2"]);
});

test("the plaza and the battle share ants; the theater replays the past alone", () => {
  expect(presenceScene("plaza")).toBe("plaza");
  expect(presenceScene("battle")).toBe("battle");
  expect(presenceScene("theater")).toBeNull();
});
