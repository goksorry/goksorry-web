import type { SupabaseClient } from "@supabase/supabase-js";
import { WORLD_RETENTION_MS, worldBucket, type WorldFrame } from "@/lib/world";

// Called only by the authenticated detector route, never by a visitor read.
export async function storeWorldSnapshot(service: SupabaseClient, frame: WorldFrame, now = new Date()): Promise<void> {
  const { error } = await service.from("world_snapshots").upsert({
    bucket_at: worldBucket(now), captured_at: now.toISOString(), frame
  }, { onConflict: "bucket_at" });
  if (error) throw new Error(`World snapshot write: ${error.message}`);
  const { error: pruneError } = await service.from("world_snapshots").delete()
    .lt("bucket_at", new Date(now.getTime() - WORLD_RETENTION_MS).toISOString());
  if (pruneError) throw new Error(`World snapshot retention: ${pruneError.message}`);
}
