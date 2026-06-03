/**
 * Bizimhesap katalog API teşhisi — alan adları ve parse istatistikleri.
 * Kullanım: npm run probe:catalog
 */
import "dotenv/config";

import { listCustomers } from "../src/services/bizimhesap/customers.js";
import { listProducts } from "../src/services/bizimhesap/products.js";
import {
  normalizeCustomerRecord,
  normalizeProductRecord,
  recordFieldNames,
} from "../src/services/matching/catalog.js";

const apiKey = process.env.BIZIMHESAP_API_KEY?.trim();
const firmId = process.env.BIZIMHESAP_FIRM_ID?.trim();
if (!apiKey || apiKey === "REPLACE_API_KEY") {
  console.error("BIZIMHESAP_API_KEY gerekli.");
  process.exit(1);
}
if (!firmId || firmId === "REPLACE_FIRM_ID") {
  console.error("BIZIMHESAP_FIRM_ID gerekli.");
  process.exit(1);
}

function sampleFields(label: string, raw: Record<string, unknown>[]) {
  console.log(`\n==> ${label} (ham kayıt: ${raw.length})`);
  if (raw.length === 0) {
    console.log("  (boş yanıt)");
    return;
  }
  for (let i = 0; i < Math.min(2, raw.length); i++) {
    console.log(`  Kayıt ${i + 1} alanları:`, recordFieldNames(raw[i]!));
    console.log(
      `  Kayıt ${i + 1} örnek:`,
      JSON.stringify(raw[i], null, 2).slice(0, 500),
    );
  }
}

const rawCustomers = await listCustomers(firmId, apiKey);
const rawProducts = await listProducts(firmId, apiKey);

sampleFields("Customers", rawCustomers);
sampleFields("Products", rawProducts);

const parsedCustomers = rawCustomers
  .map(normalizeCustomerRecord)
  .filter(Boolean);
const parsedProducts = rawProducts.map(normalizeProductRecord).filter(Boolean);

console.log("\n==> Parse özeti");
console.log(
  JSON.stringify(
    {
      customers: { raw: rawCustomers.length, parsed: parsedCustomers.length },
      products: { raw: rawProducts.length, parsed: parsedProducts.length },
      sampleProductCodes: parsedProducts.slice(0, 3).map((p) => ({
        id: p!.id,
        title: p!.title,
        codes: p!.codes,
      })),
    },
    null,
    2,
  ),
);
