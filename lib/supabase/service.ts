import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;
let freshServiceClient: SupabaseClient | null = null;

export const getServiceSupabaseClient = (options?: { cache: "no-store" }): SupabaseClient => {
  const fresh = options?.cache === "no-store";
  const cachedClient = fresh ? freshServiceClient : serviceClient;
  if (cachedClient) return cachedClient;

  const env = getSupabaseServerEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: fresh ? { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  if (fresh) freshServiceClient = client;
  else serviceClient = client;
  return client;
};
