"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { DeletePostButton } from "@/components/delete-post-button";
import { ReportForm } from "@/components/report-form";

export function PostDetailActions({
  postId,
  boardSlug,
  authorId
}: {
  postId: string;
  boardSlug: string;
  authorId: string;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="actions" />;
  }

  const isCompletedMember = Boolean(session?.user?.email) && !session?.user?.profile_setup_required;
  const canEdit = isCompletedMember && (session?.user?.role === "admin" || session?.user?.id === authorId);

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
