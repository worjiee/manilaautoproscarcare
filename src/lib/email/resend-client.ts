import "server-only";

import { Resend } from "resend";
import { readEmailConfig } from "./config";

let client: Resend | null = null;

/**
 * Returns no client while delivery is disabled. This module intentionally
 * exposes no send function in Phase 5.1.
 */
export function getResendClient(): Resend | null {
  const config = readEmailConfig();
  if (!config.enabled) return null;
  client ??= new Resend(config.resendApiKey);
  return client;
}

