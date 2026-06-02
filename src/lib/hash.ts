import { createHash } from "crypto";

export function hashDraft(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
