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

async function withDbRetries(fn, attempts = 8) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const retryable =
        msg.includes("Can't reach database server") ||
        msg.includes("Connection refused") ||
        msg.includes("ECONNREFUSED");
      if (!retryable || i === attempts) {
        throw error;
      }
      console.log(`DB not ready (attempt ${i}/${attempts}), retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastError;
}

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

const tenant = await withDbRetries(() =>
  prisma.tenant.upsert({
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
    update: {
      name: tenantName,
      bizimhesapFirmId: firmId,
      bizimhesapApiKey: apiKey,
      defaultTaxRate: taxRate,
      defaultDueDays: dueDays,
      defaultCurrency: currency,
    },
  }),
);

for (const raw of phones) {
  const phoneE164 = normalizePhoneE164(raw);
  await withDbRetries(() =>
    prisma.allowedPhone.upsert({
      where: { phoneE164 },
      create: { tenantId: tenant.id, phoneE164 },
      update: { tenantId: tenant.id },
    }),
  );
  console.log(`Allowlist: ${phoneE164}`);
}

console.log(`Tenant seeded: ${tenant.name} (${tenant.id})`);
await prisma.$disconnect();
