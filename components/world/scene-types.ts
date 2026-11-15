import type { WorldFrame, WorldScene, WorldSummary, WorldSide } from "@/lib/world";
export type EvidenceSelection = { title: string; summary: WorldSummary; side?: WorldSide };
export type SceneProps = {
  frame: WorldFrame;
  mobile: boolean;
  stock: string;
  onStock: (symbol: string) => void;
  onEvidence: (selection: EvidenceSelection) => void;
  onScene: (scene: WorldScene) => void;
  reinforcements?: number;
};
