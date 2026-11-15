"use client";
import { useEffect, useState } from "react";
import type { WallSource } from "@/lib/world-wall";

/**
 * 60 s poll for one wall panel. Stops while the tab is hidden, keeps the last
 * good payload when a refresh fails, and starts clean when the URL (scope) changes.
 */
export function usePolled<T>(url: string | null, active: boolean, refreshKey = 0): WallSource<T> {
  const [state, setState] = useState<WallSource<T> & { url: string | null }>({ data: null, failed: false, loaded: false, url });
  useEffect(() => {
    if (!url || !active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || payload?.errorMessage) throw new Error("wall data");
        if (!controller.signal.aborted) setState({ data: payload as T, failed: false, loaded: true, url });
      } catch {
        if (!controller.signal.aborted) setState((previous) => ({ data: previous.url === url ? previous.data : null, failed: true, loaded: true, url }));
      } finally {
        if (!controller.signal.aborted && !document.hidden) timer = setTimeout(() => void load(), 60_000);
      }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [url, active, refreshKey]);
  // A scope change must not show the previous scope's rows while loading.
  return state.url === url ? state : { data: null, failed: false, loaded: false };
}
