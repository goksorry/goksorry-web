import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata("관리자", "곡소리닷컴 관리자 전용 운영 화면입니다.");

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
