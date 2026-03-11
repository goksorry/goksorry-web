import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const MEMBER_SELECT = "id,email,nickname,role,created_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const parsePositiveInteger = (value: string | null, fallback: number, maxValue: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, maxValue);
};

const normalizeSearchQuery = (value: string | null): string => {
  return String(value ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ");
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const url = new URL(request.url);
  const pageSize = parsePositiveInteger(url.searchParams.get("page_size"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const requestedPage = parsePositiveInteger(url.searchParams.get("page"), 1, 10_000);
  const searchQuery = normalizeSearchQuery(url.searchParams.get("q"));

  const service = getServiceSupabaseClient();
  const buildQuery = (page: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = service
      .from("profiles")
      .select(MEMBER_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (searchQuery) {
      query = query.or(`email.ilike.%${searchQuery}%,nickname.ilike.%${searchQuery}%`);
    }

    return query;
  };

  let { data: members, error: membersError, count } = await buildQuery(requestedPage);

  if (membersError) {
    logApiError("admin member list lookup failed", requestId, membersError);
    return jsonMessage(requestId, 500, "회원 목록을 불러오지 못했습니다.");
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);

  if (currentPage !== requestedPage) {
    const fallbackResult = await buildQuery(currentPage);
    members = fallbackResult.data;
    membersError = fallbackResult.error;

    if (membersError) {
      logApiError("admin member list fallback lookup failed", requestId, membersError);
      return jsonMessage(requestId, 500, "회원 목록을 불러오지 못했습니다.");
    }
  }

  const normalized = (members ?? []).map((member) => ({
    id: String(member.id),
    email: String(member.email ?? ""),
    nickname: String(member.nickname ?? ""),
    role: member.role === "admin" ? "admin" : "user",
    created_at: member.created_at ? String(member.created_at) : null,
    is_current_user: String(member.id) === user.id
  }));

  return jsonNoStore({
    status: "ok",
    query: searchQuery,
    members: normalized,
    pagination: {
      page: currentPage,
      page_size: pageSize,
      total_count: totalCount,
      total_pages: totalPages,
      has_prev: currentPage > 1,
      has_next: currentPage < totalPages
    }
  });
}
