import { logger } from "../lib/logger.js";
import { getErrorMessage } from "../lib/errors.js";
import { handleInboundMessage } from "../services/conversation/handler.js";
import { resolveTenantByPhone } from "../services/tenant/resolve.js";
import {
  parseWhatsAppWebhookBody,
  type InboundMessage,
} from "../services/whatsapp/inbound.js";
import { sendWhatsAppText } from "../services/whatsapp/outbound.js";
import { normalizePhoneE164 } from "../lib/phone.js";

export async function processWhatsAppWebhookPayload(body: unknown): Promise<void> {
  const messages = parseWhatsAppWebhookBody(body);

  for (const message of messages) {
    await processSingleMessage(message);
  }
}

async function processSingleMessage(message: InboundMessage): Promise<void> {
  const phoneE164 = normalizePhoneE164(message.from);

  try {
    const tenant = await resolveTenantByPhone(phoneE164);
    if (!tenant) {
      logger.warn({ phoneE164 }, "Unauthorized WhatsApp number");
      try {
        await sendWhatsAppText(
          phoneE164,
          "Bu numara Alex Bizimhesap için yetkili değil.",
        );
      } catch {
        // ignore if WhatsApp not configured
      }
      return;
    }

    await handleInboundMessage(tenant, message);
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error({ error, phoneE164 }, "Inbound message processing failed");
    if (msg.includes("401")) {
      logger.error(
        "WhatsApp 401: Railway accurate-analysis → WHATSAPP_ACCESS_TOKEN güncelleyin → npm run railway:import-secrets → redeploy",
      );
    }
    try {
      await sendWhatsAppText(
        phoneE164,
        msg.includes("401")
          ? "WhatsApp yapılandırma hatası — yönetici token'ı güncellemeli. Kısa süre sonra tekrar deneyin."
          : `Bir hata oluştu: ${msg}`,
      );
    } catch {
      // ignore secondary failure
    }
  }
}
