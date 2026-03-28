"use client";

import Link from "next/link";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

export function CommunityBoardActions({ boardSlug }: { boardSlug: string }) {
  const { user, status } = useSessionSnapshot();
  const isCompletedMember = Boolean(user?.email) && !user?.profile_setup_required;
  const isAdmin = user?.role === "admin";
  const canWrite = boardSlug !== "notice" || (isCompletedMember && isAdmin);

  return (
    <>
      <div className="actions" style={{ marginBottom: "0.9rem" }}>
        {canWrite ? (
          <Link className="btn" href={`/community/${boardSlug}/new`}>
            글쓰기
          </Link>
        ) : null}
        <Link className="btn btn-secondary" href="/community">
          게시판 목록
        </Link>
      </div>
      {boardSlug === "notice" && status !== "loading" && !canWrite ? (
        <p className="muted">공지 작성은 관리자만 가능합니다.</p>
      ) : null}
    </>
  );
}
