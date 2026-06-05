export const GOKSORRY_INDEX_TTL_SEC = 60;

export type GoksorryIndexApiPayload = {
  goksorry_index: number;
  generated_at: string;
  ttl_sec: number;
};

export const buildGoksorryIndexApiPayload = ({
  generated_at,
  overall_goksorry_index
}: {
  generated_at: string;
  overall_goksorry_index: number;
}): GoksorryIndexApiPayload => ({
  goksorry_index: Number(overall_goksorry_index.toFixed(1)),
  generated_at,
  ttl_sec: GOKSORRY_INDEX_TTL_SEC
});
