import { getEnv } from "../../config/env.js";

export function verifyWebhookChallenge(query: {
  mode?: string;
  verifyToken?: string;
  challenge?: string;
}): string | null {
  const env = getEnv();
  if (
    query.mode === "subscribe" &&
    query.verifyToken === env.WEBHOOK_VERIFY_TOKEN &&
    query.challenge
  ) {
    return query.challenge;
  }
  return null;
}
