/**
 * Production container catalog sync (node only, no tsx).
 * Runs after seed-production.mjs in Dockerfile CMD.
 *
 * NOT for `railway run` from local machine — internal DB hostname won't resolve.
 */
import { PrismaClient } from "@prisma/client";
import { listCustomers } from "../dist/services/bizimhesap/customers.js";
import { listProducts } from "../dist/services/bizimhesap/products.js";
import {
  getAllProductCodes,
  normalizeCustomerRecord,
  normalizeProductRecord,
} from "../dist/services/matching/catalog.js";
import { normalizeCode } from "../dist/services/matching/score.js";

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

const firmId =
  process.env.BIZIMHESAP_FIRM_ID?.trim() || "REPLACE_FIRM_ID";
const apiKey =
  process.env.BIZIMHESAP_API_KEY?.trim() || "REPLACE_API_KEY";

if (firmId === "REPLACE_FIRM_ID" || apiKey === "REPLACE_API_KEY") {
  console.log("Bizimhesap credentials missing — catalog sync skipped.");
  await prisma.$disconnect();
  process.exit(0);
}

const tenant = await withDbRetries(() =>
  prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } }),
);

if (!tenant) {
  console.log("No tenant — catalog sync skipped.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`Catalog sync for tenant: ${tenant.name} (${tenant.id})`);

let rawCustomers;
let rawProducts;
try {
  rawCustomers = await listCustomers(firmId, apiKey);
  rawProducts = await listProducts(firmId, apiKey);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Bizimhesap catalog fetch failed: ${msg}`);
  await prisma.$disconnect();
  process.exit(0);
}

console.log(
  `Fetched: ${rawCustomers.length} customers, ${rawProducts.length} products (raw)`,
);

let customerCount = 0;
for (const row of rawCustomers) {
  const c = normalizeCustomerRecord(row);
  if (!c) continue;
  await withDbRetries(() =>
    prisma.customerMapping.upsert({
      where: {
        tenantId_localName: { tenantId: tenant.id, localName: c.title },
      },
      create: {
        tenantId: tenant.id,
        localName: c.title,
        bizimhesapCustomerId: c.id,
      },
      update: { bizimhesapCustomerId: c.id },
    }),
  );
  customerCount++;
}

let productCount = 0;
let skuMappingCount = 0;
for (const row of rawProducts) {
  const p = normalizeProductRecord(row);
  if (!p) continue;

  await withDbRetries(() =>
    prisma.productMapping.upsert({
      where: {
        tenantId_localName: { tenantId: tenant.id, localName: p.title },
      },
      create: {
        tenantId: tenant.id,
        localName: p.title,
        localSku: p.codes[0] ?? null,
        bizimhesapProductId: p.id,
      },
      update: {
        bizimhesapProductId: p.id,
        ...(p.codes[0] ? { localSku: p.codes[0] } : {}),
      },
    }),
  );
  productCount++;

  for (const code of getAllProductCodes(p)) {
    const normalized = normalizeCode(code);
    if (normalized.length < 2) continue;

    try {
      const existing = await withDbRetries(() =>
        prisma.productMapping.findFirst({
          where: { tenantId: tenant.id, localSku: code },
        }),
      );
      if (existing) {
        await withDbRetries(() =>
          prisma.productMapping.update({
            where: { id: existing.id },
            data: { bizimhesapProductId: p.id },
          }),
        );
      } else {
        await withDbRetries(() =>
          prisma.productMapping.create({
            data: {
              tenantId: tenant.id,
              localName: `${p.title} [${code}]`.slice(0, 200),
              localSku: code,
              bizimhesapProductId: p.id,
            },
          }),
        );
      }
      skuMappingCount++;
    } catch {
      // duplicate local_name — skip
    }
  }
}

console.log(
  `Catalog sync done: ${customerCount} cari, ${productCount} ürün, ${skuMappingCount} kod eşlemesi`,
);
await prisma.$disconnect();
