import { env } from "./env.js";

export const supabaseConfig = {
  url: env.supabaseUrl,
  serviceRoleKey: env.supabaseServiceRoleKey,
  documentBucket: env.supabaseDocumentBucket,
  isConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
};
