import { config } from "dotenv";
config();

import { getAllowedPhonesFromEnv, getEnv } from "../src/config/env.js";
import { prisma } from "../src/db/client.js";
import { normalizePhoneE164 } from "../src/lib/phone.js";

const env = getEnv();
const firmId = env.BIZIMHESAP_FIRM_ID ?? "REPLACE_FIRM_ID";
const apiKey = env.BIZIMHESAP_API_KEY ?? "REPLACE_API_KEY";
const phones = getAllowedPhonesFromEnv();

const tenant = await prisma.tenant.upsert({
  where: { id: "seed-pilot" },
  create: {
    id: "seed-pilot",
    name: env.TENANT_NAME,
    bizimhesapFirmId: firmId,
    bizimhesapApiKey: apiKey,
    defaultTaxRate: env.DEFAULT_TAX_RATE,
    defaultDueDays: env.DEFAULT_DUE_DAYS,
    defaultCurrency: env.DEFAULT_CURRENCY,
  },
  update: {
    name: env.TENANT_NAME,
    bizimhesapFirmId: firmId,
    bizimhesapApiKey: apiKey,
    defaultTaxRate: env.DEFAULT_TAX_RATE,
    defaultDueDays: env.DEFAULT_DUE_DAYS,
    defaultCurrency: env.DEFAULT_CURRENCY,
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
