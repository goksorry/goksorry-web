import { redirect } from "next/navigation";

export default function AnalysisPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (value) params.set(key, Array.isArray(value) ? value[0] : value);
  redirect(params.size ? `/?${params}` : "/");
}
