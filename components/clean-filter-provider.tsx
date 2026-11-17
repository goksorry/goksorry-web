"use client";
import type { ReactNode } from "react";

// Compatibility for existing theme consumers. Title rewriting has been retired;
// no preference cookie, transition animation or first-visit prompt remains.
const disabled = {
  cleanFilterEnabled: false, isApplying: false,
  animationMode: null as "pretty" | "grim" | null,
  animationOrigin: null as { x: number; y: number } | null,
  showFirstVisitPrompt: false,
  applyCleanFilter: (_enabled: boolean, _origin?: { x: number; y: number }) => {},
  dismissFirstVisitPrompt: () => {}
};
export function CleanFilterProvider({ children }: { children: ReactNode }) { return children; }
export const useCleanFilter = () => disabled;
