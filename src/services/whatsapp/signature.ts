import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "../../config/env.js";

export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  const env = getEnv();
  if (env.SKIP_WHATSAPP_SIGNATURE) return true;
  if (!env.WHATSAPP_APP_SECRET) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  const received = signatureHeader.slice("sha256=".length);

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex"),
    );
  } catch {
    return false;
  }
}
