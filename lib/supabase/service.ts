import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;
let freshServiceClient: SupabaseClient | null = null;

export const getServiceSupabaseClient = (options?: { cache: "no-store"; signal?: AbortSignal }): SupabaseClient => {
  const fresh = options?.cache === "no-store";
  const scopedSignal = options?.signal;
  const cachedClient = fresh ? freshServiceClient : serviceClient;
  if (cachedClient && !scopedSignal) return cachedClient;

  const env = getSupabaseServerEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: fresh ? { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", ...(scopedSignal ? { signal: scopedSignal } : {}) }) } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  if (scopedSignal) return client;
  if (fresh) freshServiceClient = client;
  else serviceClient = client;
  return client;
};
