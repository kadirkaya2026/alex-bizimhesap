/**
 * Production container seed (node only, no tsx).
 * Runs after prisma migrate deploy in Dockerfile CMD.
 */
import { PrismaClient } from "@prisma/client";

function normalizePhoneE164(input) {
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("90") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+9${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return `+${digits}`;
}

const prisma = new PrismaClient();

const tenantName = process.env.TENANT_NAME ?? "Pilot Firma";
const firmId = process.env.BIZIMHESAP_FIRM_ID?.trim() || "REPLACE_FIRM_ID";
const apiKey = process.env.BIZIMHESAP_API_KEY?.trim() || "REPLACE_API_KEY";
const taxRate = Number(process.env.DEFAULT_TAX_RATE ?? 20);
const dueDays = Number(process.env.DEFAULT_DUE_DAYS ?? 30);
const currency = process.env.DEFAULT_CURRENCY ?? "TL";
const phones = (process.env.ALEX_ALLOWED_PHONES ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const existing = await prisma.tenant.findUnique({ where: { id: "seed-pilot" } });

const tenant = await prisma.tenant.upsert({
  where: { id: "seed-pilot" },
  create: {
    id: "seed-pilot",
    name: tenantName,
    bizimhesapFirmId: firmId,
    bizimhesapApiKey: apiKey,
    defaultTaxRate: taxRate,
    defaultDueDays: dueDays,
    defaultCurrency: currency,
  },
  update: existing
    ? {
        name: tenantName,
        defaultTaxRate: taxRate,
        defaultDueDays: dueDays,
        defaultCurrency: currency,
        ...(firmId !== "REPLACE_FIRM_ID" ? { bizimhesapFirmId: firmId } : {}),
        ...(apiKey !== "REPLACE_API_KEY" ? { bizimhesapApiKey: apiKey } : {}),
      }
    : {
        name: tenantName,
        bizimhesapFirmId: firmId,
        bizimhesapApiKey: apiKey,
        defaultTaxRate: taxRate,
        defaultDueDays: dueDays,
        defaultCurrency: currency,
      },
});

for (const raw of phones) {
  const phoneE164 = normalizePhoneE164(raw);
  await prisma.allowedPhone.upsert({
    where: { phoneE164 },
    create: { tenantId: tenant.id, phoneE164 },
    update: { tenantId: tenant.id },
  });
  console.log(`Allowlist: ${phoneE164}`);
}

console.log(`Tenant seeded: ${tenant.name} (${tenant.id})`);
await prisma.$disconnect();
