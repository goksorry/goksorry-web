import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { getCompletedProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { POLICY_DOCUMENT_META, type PolicyDocumentType } from "@/lib/policy-defaults";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type PolicyVersionRow = {
  id: string;
  type: PolicyDocumentType;
  summary: string;
  body: string;
  is_adverse: boolean;
  published_at: string;
  effective_at: string;
  updated_at: string;
  superseded_at: string | null;
  created_at: string;
};

type PolicyHistoryStatus = "current" | "pending" | "historical" | "superseded";

const POLICY_TYPES: PolicyDocumentType[] = ["terms", "privacy"];
const ADVERSE_PENDING_DAYS = 7;
const MAX_POLICY_BODY_LENGTH = 50_000;
const MAX_POLICY_SUMMARY_LENGTH = 120;

const isMissingPolicyDocumentVersionsTableError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("policy_document_versions") ||
    message.includes("schema cache")
  );
};

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const sanitizePolicyType = (value: unknown): PolicyDocumentType | null => {
  return value === "terms" || value === "privacy" ? value : null;
};

const sanitizeSummary = (value: unknown): string | null => {
  const summary = String(value ?? "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, MAX_POLICY_SUMMARY_LENGTH);
  return summary || null;
};

const sanitizeBody = (value: unknown): string | null => {
  const body = String(value ?? "").replace(/\r/g, "").trim();
  if (!body || body.length > MAX_POLICY_BODY_LENGTH) {
    return null;
  }
  return body;
};

const getStatus = ({
  row,
  currentId,
  pendingId
}: {
  row: PolicyVersionRow;
  currentId: string | null;
  pendingId: string | null;
}): PolicyHistoryStatus => {
  if (row.id === currentId) {
    return "current";
  }
  if (row.id === pendingId) {
    return "pending";
  }
  if (row.superseded_at) {
    return "superseded";
  }
  return "historical";
};

const loadPolicySnapshots = async (): Promise<Record<PolicyDocumentType, Record<string, unknown>>> => {
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("policy_document_versions")
    .select("id,type,summary,body,is_adverse,published_at,effective_at,updated_at,superseded_at,created_at")
    .in("type", POLICY_TYPES)
    .order("published_at", { ascending: false })
    .limit(100)
    .returns<PolicyVersionRow[]>();

  if (error) {
    if (isMissingPolicyDocumentVersionsTableError(error.code, error.message)) {
      throw new Error("정책 문서 저장소를 확인할 수 없습니다.");
    }

    throw new Error("정책 문서 조회 중 오류가 발생했습니다.");
  }

  const now = Date.now();
  const grouped = {
    terms: [] as PolicyVersionRow[],
    privacy: [] as PolicyVersionRow[]
  };

  for (const row of (data ?? []) as PolicyVersionRow[]) {
    grouped[row.type].push(row);
  }

  return POLICY_TYPES.reduce<Record<PolicyDocumentType, Record<string, unknown>>>((acc, type) => {
    const rows = grouped[type];
    if (rows.length === 0) {
      throw new Error(`${POLICY_DOCUMENT_META[type].title} 문서가 등록되어 있지 않습니다.`);
    }

    const current = rows.find((row) => !row.superseded_at && new Date(row.effective_at).getTime() <= now) ?? rows[0];
    const pending =
      rows
        .filter((row) => !row.superseded_at && new Date(row.effective_at).getTime() > now)
        .sort((left, right) => new Date(left.effective_at).getTime() - new Date(right.effective_at).getTime())[0] ?? null;

    acc[type] = {
      type,
      title: POLICY_DOCUMENT_META[type].title,
      current,
      pending,
      history: rows.map((row) => ({
        ...row,
        status: getStatus({
          row,
          currentId: current?.id ?? null,
          pendingId: pending?.id ?? null
        })
      }))
    };
    return acc;
  }, {} as Record<PolicyDocumentType, Record<string, unknown>>);
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const profile = await getCompletedProfileForUser(user);
  if (!profile || (profile.role !== "admin" && !isAdminEmail(user.email))) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  try {
    const documents = await loadPolicySnapshots();
    return jsonNoStore({ documents });
  } catch (error) {
    logApiError("admin policy snapshot lookup failed", requestId, error);
    return jsonMessage(requestId, 500, error instanceof Error ? error.message : "정책 문서를 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const profile = await getCompletedProfileForUser(user);
  if (!profile || (profile.role !== "admin" && !isAdminEmail(user.email))) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  let body: {
    type?: unknown;
    summary?: unknown;
    body?: unknown;
    is_adverse?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  const type = sanitizePolicyType(body.type);
  if (!type) {
    return jsonMessage(requestId, 400, "정책 종류가 올바르지 않습니다.");
  }

  const summary = sanitizeSummary(body.summary);
  if (!summary) {
    return jsonMessage(requestId, 400, "변경 요약을 입력해 주세요.");
  }

  const content = sanitizeBody(body.body);
  if (!content) {
    return jsonMessage(requestId, 400, "문서 본문을 입력해 주세요.");
  }

  const isAdverse = body.is_adverse === true;
  const service = getServiceSupabaseClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const effectiveAtIso = isAdverse
    ? new Date(now.getTime() + ADVERSE_PENDING_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : nowIso;

  const { error: supersedeError } = await service
    .from("policy_document_versions")
    .update({
      superseded_at: nowIso
    })
    .eq("type", type)
    .is("superseded_at", null)
    .gt("effective_at", nowIso);

  if (supersedeError) {
    logApiError("admin policy supersede failed", requestId, supersedeError);
    return jsonMessage(requestId, 500, "기존 대기 중 문서를 정리하지 못했습니다.");
  }

  const { error: insertError } = await service.from("policy_document_versions").insert({
    type,
    summary,
    body: content,
    is_adverse: isAdverse,
    published_at: nowIso,
    effective_at: effectiveAtIso,
    updated_at: nowIso,
    created_by: profile.id
  });

  if (insertError) {
    logApiError("admin policy insert failed", requestId, insertError);
    return jsonMessage(requestId, 500, "정책 문서를 저장하지 못했습니다.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/admin/policies");

  return jsonNoStore({
    ok: true,
    effective_at: effectiveAtIso
  });
}
