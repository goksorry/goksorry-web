"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export const getBrowserSupabaseClient = (): SupabaseClient => {
  if (browserClient) {
    return browserClient;
  }

  const env = getPublicEnv();
  browserClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return browserClient;
};
