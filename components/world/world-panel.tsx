"use client";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

export type PanelOrigin = { x: number; y: number; width: number; height: number };
export function WorldPanel({ title, name, children, onClose, modal = false, origin = null }: {
  title: string; name: string; children: ReactNode; onClose: () => void; modal?: boolean; origin?: PanelOrigin | null;
}) {
  const panel = useRef<HTMLElement>(null);
  // Capture before the background becomes inert during the commit.
  const previous = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  const close = useRef(onClose);
  close.current = onClose;
  // Grow out of the wall panel (or button) that opened this dialog.
  const from = useRef(origin);
  useLayoutEffect(() => {
    const node = panel.current, start = from.current;
    if (!node || !start || typeof node.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = node.getBoundingClientRect();
    if (!end.width || !end.height) return;
    const dx = start.x + start.width / 2 - (end.x + end.width / 2), dy = start.y + start.height / 2 - (end.y + end.height / 2);
    node.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(.05, start.width / end.width)}, ${Math.max(.05, start.height / end.height)})`, opacity: .3 },
      { transform: "none", opacity: 1 }
    ], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, []);
  useEffect(() => {
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      const floating = [...document.querySelectorAll('[role="menu"], [role="dialog"][aria-modal="true"]')]
        .some((node) => !node.hasAttribute("data-world-panel") && node.getClientRects().length > 0);
      if (floating) return; // Existing theme/filter dialogs own their keyboard events.
      const all = document.querySelectorAll("[data-world-panel]");
      const active = document.activeElement?.closest("[data-world-panel]") ?? all[all.length - 1];
      if (active !== panel.current || event.defaultPrevented) return;
      const innerDialog = (event.target as Element).closest('[role="dialog"]');
      if (innerDialog && innerDialog !== panel.current) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== "Tab" || (!modal && !window.matchMedia("(max-width: 760px)").matches)) return;
      // A theme chooser may open its own portaled dialog above this panel.
      if ((event.target as Element).closest('[role="dialog"]') && !panel.current?.contains(event.target as Node)) return;
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,summary,[tabindex="0"]') ?? [])]
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      const outside = !panel.current?.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (outside || document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (previous.current?.isConnected) previous.current.focus({ preventScroll: true }); };
  }, [modal]);
  const content = <section ref={panel} tabIndex={-1} role="dialog" aria-modal={modal || undefined} aria-label={title}
    className={`world-panel world-panel-${name}`} data-world-panel={name}>
    <div className="world-panel-heading"><h2>{title}</h2><button type="button" aria-label={`${title} 닫기`} onClick={onClose}>✕</button></div>
    <div className="world-panel-body">{children}</div>
  </section>;
  return modal ? <div className="world-modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); onClose(); } }}>{content}</div> : content;
}
