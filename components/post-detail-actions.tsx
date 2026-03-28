"use client";

import Link from "next/link";
import { DeletePostButton } from "@/components/delete-post-button";
import { ReportForm } from "@/components/report-form";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

export function PostDetailActions({
  postId,
  boardSlug,
  authorId
}: {
  postId: string;
  boardSlug: string;
  authorId: string;
}) {
  const { user } = useSessionSnapshot();
  const isCompletedMember = Boolean(user?.email) && !user?.profile_setup_required;
  const canEdit = isCompletedMember && (user?.role === "admin" || user?.id === authorId);

  return (
    <div className="actions">
      {canEdit ? (
        <>
          <Link className="btn btn-secondary" href={`/community/${boardSlug}/${postId}/edit`}>
            글 수정
          </Link>
          <DeletePostButton postId={postId} boardSlug={boardSlug} />
        </>
      ) : null}
      {isCompletedMember ? <ReportForm targetType="post" targetId={postId} /> : null}
    </div>
  );
}
