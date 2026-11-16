import "server-only";

import { Resend } from "resend";
import { readEmailConfig } from "./config";

let client: Resend | null = null;

/** Returns no client while delivery is disabled. */
export function getResendClient(): Resend | null {
  const config = readEmailConfig();
  if (!config.enabled) return null;
  client ??= new Resend(config.resendApiKey);
  return client;
}

