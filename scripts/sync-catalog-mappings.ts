/**
 * Bizimhesap kataloğundan customer_mappings / product_mappings tablolarını doldurur.
 * Kullanım: npm run sync:catalog-mappings
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { listCustomers } from "../src/services/bizimhesap/customers.js";
import { listProducts } from "../src/services/bizimhesap/products.js";
import {
  getAllProductCodes,
  normalizeCustomerRecord,
  normalizeProductRecord,
} from "../src/services/matching/catalog.js";
import { normalizeCode } from "../src/services/matching/score.js";

const prisma = new PrismaClient();

const apiKey = process.env.BIZIMHESAP_API_KEY?.trim();
if (!apiKey || apiKey === "REPLACE_API_KEY") {
  console.error("BIZIMHESAP_API_KEY .env içinde gerekli.");
  process.exit(1);
}

const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
if (!tenant) {
  console.error("Tenant bulunamadı — önce npm run db:seed");
  process.exit(1);
}

console.log(`Tenant: ${tenant.name} (${tenant.id})`);

const rawCustomers = await listCustomers(apiKey);
const rawProducts = await listProducts(apiKey);

let customerCount = 0;
for (const row of rawCustomers) {
  const c = normalizeCustomerRecord(row);
  if (!c) continue;
  await prisma.customerMapping.upsert({
    where: {
      tenantId_localName: { tenantId: tenant.id, localName: c.title },
    },
    create: {
      tenantId: tenant.id,
      localName: c.title,
      bizimhesapCustomerId: c.id,
    },
    update: { bizimhesapCustomerId: c.id },
  });
  customerCount++;
}

let productCount = 0;
let skuMappingCount = 0;
for (const row of rawProducts) {
  const p = normalizeProductRecord(row);
  if (!p) continue;

  await prisma.productMapping.upsert({
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
  });
  productCount++;

  for (const code of getAllProductCodes(p)) {
    const normalized = normalizeCode(code);
    if (normalized.length < 2) continue;

    const skuKey = `${p.id}:${normalized}`;
    const localNameForSku = `${p.title} [${code}]`;

    try {
      const existing = await prisma.productMapping.findFirst({
        where: { tenantId: tenant.id, localSku: code },
      });
      if (existing) {
        await prisma.productMapping.update({
          where: { id: existing.id },
          data: { bizimhesapProductId: p.id },
        });
      } else {
        await prisma.productMapping.create({
          data: {
            tenantId: tenant.id,
            localName: localNameForSku.slice(0, 200),
            localSku: code,
            bizimhesapProductId: p.id,
          },
        });
      }
      skuMappingCount++;
    } catch {
      // duplicate local_name — skip
      void skuKey;
    }
  }
}

console.log(
  `Eşleme tamamlandı: ${customerCount} cari, ${productCount} ürün, ${skuMappingCount} kod eşlemesi`,
);
await prisma.$disconnect();
