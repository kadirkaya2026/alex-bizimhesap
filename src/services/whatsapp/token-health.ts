import { getEnv, isWhatsAppConfigured } from "../../config/env.js";

export interface WhatsAppHealthInfo {
  configured: boolean;
  phoneNumberId: string | null;
  tokenLength: number;
  tokenLooksValid: boolean;
  appSecretSet: boolean;
}

export function getWhatsAppHealthInfo(): WhatsAppHealthInfo {
  const env = getEnv();
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";

  return {
    configured: isWhatsAppConfigured(),
    phoneNumberId: phoneId || null,
    tokenLength: token.length,
    tokenLooksValid: token.startsWith("EAA") && token.length >= 100,
    appSecretSet: Boolean(env.WHATSAPP_APP_SECRET?.trim()),
  };
}

export async function probeWhatsAppToken(): Promise<{
  ok: boolean;
  status: number;
  verifiedName?: string;
  displayPhoneNumber?: string;
}> {
  const env = getEnv();
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneId) {
    return { ok: false, status: 0 };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as {
    display_phone_number?: string;
    verified_name?: string;
  };

  return {
    ok: true,
    status: response.status,
    verifiedName: data.verified_name,
    displayPhoneNumber: data.display_phone_number,
  };
}
