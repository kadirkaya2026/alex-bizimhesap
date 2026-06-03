import { getAllowedPhonesFromEnv, getEnv } from "../../config/env.js";
import { prisma } from "../../db/client.js";
import { normalizePhoneE164 } from "../../lib/phone.js";

export interface ResolvedTenant {
  tenantId: string;
  phoneE164: string;
  bizimhesapFirmId: string;
  bizimhesapApiKey: string;
  defaultTaxRate: number;
  defaultDueDays: number;
  defaultCurrency: string;
}

/** Railway env güncel; DB seed eski kalabiliyor — env öncelikli. */
function resolveBizimhesapCreds(tenant: {
  bizimhesapFirmId: string;
  bizimhesapApiKey: string;
}) {
  const env = getEnv();
  const envFirmId = env.BIZIMHESAP_FIRM_ID?.trim();
  const envApiKey = env.BIZIMHESAP_API_KEY?.trim();
  const tenantFirmId = tenant.bizimhesapFirmId.trim();
  const tenantApiKey = tenant.bizimhesapApiKey.trim();

  return {
    bizimhesapFirmId:
      envFirmId && envFirmId !== "REPLACE_FIRM_ID"
        ? envFirmId
        : tenantFirmId,
    bizimhesapApiKey:
      envApiKey && envApiKey !== "REPLACE_API_KEY"
        ? envApiKey
        : tenantApiKey,
  };
}

export async function resolveTenantByPhone(
  rawPhone: string,
): Promise<ResolvedTenant | null> {
  const phoneE164 = normalizePhoneE164(rawPhone);

  const allowed = await prisma.allowedPhone.findUnique({
    where: { phoneE164 },
    include: { tenant: true },
  });

  if (allowed) {
    const t = allowed.tenant;
    const bh = resolveBizimhesapCreds(t);
    return {
      tenantId: t.id,
      phoneE164,
      ...bh,
      defaultTaxRate: Number(t.defaultTaxRate),
      defaultDueDays: t.defaultDueDays,
      defaultCurrency: t.defaultCurrency,
    };
  }

  // Fallback: env allowlist + first tenant (MVP bootstrap)
  const envPhones = getAllowedPhonesFromEnv().map(normalizePhoneE164);
  if (!envPhones.includes(phoneE164)) {
    return null;
  }

  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) return null;

  const bh = resolveBizimhesapCreds(tenant);
  return {
    tenantId: tenant.id,
    phoneE164,
    ...bh,
    defaultTaxRate: Number(tenant.defaultTaxRate),
    defaultDueDays: tenant.defaultDueDays,
    defaultCurrency: tenant.defaultCurrency,
  };
}
