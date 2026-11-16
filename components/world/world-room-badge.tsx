"use client";
import { useState, type FormEvent } from "react";
import { PLAZA_ROOM_LIMIT, PLAZA_ROOM_SIZE, parseRoomInput } from "@/lib/world-presence";

type Props = { room: number | null; peers: number; error: string | null; onSwitch: (room: number) => void };

/** Plaza room (shown from 1) and how many viewers stand in it; the viewer may type another room to move there. */
export function WorldRoomBadge({ room, peers, error, onSwitch }: Props) {
  const [editing, setEditing] = useState(false), [value, setValue] = useState(""), [invalid, setInvalid] = useState(false);
  if (room === null) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = parseRoomInput(value);
    if (next === null) { setInvalid(true); return; }
    setInvalid(false); setEditing(false); setValue("");
    if (next !== room) onSwitch(next);
  };
  return <div className="world-room-badge" data-testid="world-room">
    <span><b>{room + 1}번 방</b> · {peers + 1}/{PLAZA_ROOM_SIZE}명</span>
    {editing ? <form onSubmit={submit}>
      <label><span className="sr-only">이동할 방 번호</span>
        <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} autoFocus value={value} placeholder={`1~${PLAZA_ROOM_LIMIT}`} aria-invalid={invalid}
          onChange={(event) => { setValue(event.target.value.replace(/\D/g, "")); setInvalid(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") { setEditing(false); setValue(""); } }} />
      </label>
      <button type="submit">이동</button>
      <button type="button" onClick={() => { setEditing(false); setValue(""); setInvalid(false); }}>취소</button>
    </form> : <button type="button" onClick={() => setEditing(true)}>방 이동</button>}
    {(invalid || error) && <p role="status">{invalid ? `1~${PLAZA_ROOM_LIMIT} 사이 번호를 입력하세요.` : error}</p>}
  </div>;
}
