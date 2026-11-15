import type { WorldSummary, WorldSide } from "@/lib/world";
import type { SourceGroupId } from "@/lib/feed-source-groups";
export type EvidenceSelection = { title: string; summary: WorldSummary; side?: WorldSide; symbol?: string; community?: SourceGroupId; recordedAt?: string };
