import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

export const getServiceSupabaseClient = (): SupabaseClient => {
  if (serviceClient) {
    return serviceClient;
  }

  const env = getSupabaseServerEnv();
  serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return serviceClient;
};
