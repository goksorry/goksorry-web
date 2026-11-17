import type { SupabaseClient } from "@supabase/supabase-js";
import { worldBucket, type WorldFrame } from "@/lib/world";
import { worldRecord } from "@/lib/world-record";

// Called only by the authenticated detector route, never by a visitor read. Only index data is stored (see world-record.ts).
export async function storeWorldSnapshot(service: SupabaseClient, frame: WorldFrame, now = new Date()): Promise<void> {
  const { error } = await service.from("world_snapshots").upsert({
    bucket_at: worldBucket(now), captured_at: now.toISOString(), frame: worldRecord(frame)
  }, { onConflict: "bucket_at" });
  if (error) throw new Error(`World snapshot write: ${error.message}`);
  // Expired snapshots are removed by the twice-daily database job.
}
