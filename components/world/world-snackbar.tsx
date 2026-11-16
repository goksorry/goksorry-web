"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** `error` stays until its source clears it or the visitor closes it; `info` also closes itself after a while. */
export type Snack = { text: string; tone: "error" | "info"; action?: { label: string; run: () => void } };
type Entry = Snack & { id: string };
type Store = { put(id: string, snack: Snack | null): void };

const Context = createContext<Store | null>(null);
/** How long an `info` snack stays up. */
const INFO_MS = 6000;

/**
 * Declares a snack for as long as `snack` is non-null; `id` names the source so it never stacks twice.
 * A closed snack comes back only when its text changes.
 */
export function useWorldSnack(id: string, snack: Snack | null) {
  const store = useContext(Context);
  // The action closure changes every render; the entry calls whatever is latest.
  const run = useRef(snack?.action?.run); run.current = snack?.action?.run;
  const text = snack?.text ?? null, tone = snack?.tone ?? "info", label = snack?.action?.label ?? null;
  useEffect(() => {
    if (!store) return;
    store.put(id, text === null ? null : { text, tone, action: label ? { label, run: () => run.current?.() } : undefined });
    return () => store.put(id, null);
  }, [store, id, text, tone, label]);
}

/** Holds the world's snacks and shows them as a stack above the scene nav. */
export function WorldSnackbarProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const closed = useRef(new Map<string, string>());
  const put = useCallback((id: string, snack: Snack | null) => {
    if (snack && closed.current.get(id) === snack.text) return;
    if (!snack) closed.current.delete(id);
    setEntries((list) => {
      const rest = list.filter((entry) => entry.id !== id);
      return snack ? [...rest, { ...snack, id }] : rest;
    });
  }, []);
  const close = useCallback((entry: Entry) => { closed.current.set(entry.id, entry.text); setEntries((list) => list.filter((e) => e.id !== entry.id)); }, []);
  const store = useMemo<Store>(() => ({ put }), [put]);
  return <Context.Provider value={store}>
    {children}
    <div className="world-snackbar-stack" aria-label="알림">
      {entries.map((entry) => <SnackItem key={`${entry.id}|${entry.text}`} entry={entry} onClose={() => close(entry)} />)}
    </div>
  </Context.Provider>;
}

function SnackItem({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (entry.tone !== "info") return;
    const timer = setTimeout(() => close.current(), INFO_MS); return () => clearTimeout(timer);
  }, [entry.tone]);
  return <div className="world-snackbar" data-tone={entry.tone} role={entry.tone === "error" ? "alert" : "status"}>
    <span>{entry.text}</span>
    {entry.action && <button type="button" onClick={entry.action.run}>{entry.action.label}</button>}
    <button type="button" className="world-snackbar-close" aria-label="알림 닫기" onClick={onClose}>✕</button>
  </div>;
}
