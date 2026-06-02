import { getAllowedPhonesFromEnv } from "../../config/env.js";
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
    return {
      tenantId: t.id,
      phoneE164,
      bizimhesapFirmId: t.bizimhesapFirmId,
      bizimhesapApiKey: t.bizimhesapApiKey,
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

  return {
    tenantId: tenant.id,
    phoneE164,
    bizimhesapFirmId: tenant.bizimhesapFirmId,
    bizimhesapApiKey: tenant.bizimhesapApiKey,
    defaultTaxRate: Number(tenant.defaultTaxRate),
    defaultDueDays: tenant.defaultDueDays,
    defaultCurrency: tenant.defaultCurrency,
  };
}
