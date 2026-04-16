import type { ReactNode } from "react";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata("인증", "곡소리닷컴 로그인 및 인증 전용 화면입니다.");

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
