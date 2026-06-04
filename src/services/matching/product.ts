import { prisma } from "../../db/client.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import type { CatalogCache, CatalogProduct } from "./catalog.js";
import { searchProductInCatalog } from "./catalog.js";
import { extractLineCodeCandidates } from "./extract-codes.js";
import { getAutoMatchThreshold, scoreNameMatch } from "./score.js";
import type { MatchSource } from "./customer.js";
import type { MatchSuggestion } from "./types.js";

export interface ResolvedProductLine {
  productId?: string;
  name: string;
  sku?: string;
  bizimhesapTitle?: string;
  bizimhesapBarcode?: string;
  invoiceLineNote?: string;
  matchScore?: number;
  source: MatchSource;
  suggestion?: MatchSuggestion;
  quantity?: number; // Adet bilgisini taşımak için eklendi
}

// Bizimhesap katalog ürününü fatura formatına güvenli eşleme fonksiyonu
function mapCatalogProductToMeta(product: CatalogProduct, originalLineName: string) {
  return {
    bizimhesapTitle: product.title || originalLineName, // ASIL HATA BURADAYDI: Asla code/id basma, gerçek başlığı bas!
    bizimhesapBarcode: product.barcode || (product.codes && product.codes[0]) || "",
    invoiceLineNote: `Orijinal Fiş Adı: ${originalLineName}`
  };
}

async function enrichFromCatalog(
  catalog: CatalogCache | undefined,
  productId: string,
  partial: ResolvedProductLine,
): Promise<ResolvedProductLine> {
  if (!catalog) return partial;
  const product = await catalog.findProductById(productId);
  if (!product) return partial;
  const meta = mapCatalogProductToMeta(product, partial.name);
  return { ...partial, ...meta };
}

async function learnProductMapping(
  tenantId: string,
  line: OrderDraftLine,
  product: CatalogProduct,
): Promise<void> {
  const localName = line.name.trim();
  const localSku = product.codes && product.codes[0] ? product.codes[0] : null;

  await prisma.productMapping.upsert({
    where: { tenantId_localName: { tenantId, localName } },
    create: { tenantId, localName, localSku, bizimhesapProductId: product.id },
    update: { bizimhesapProductId: product.id, ...(localSku ? { localSku } : {}) },
  });
}

export async function isDbMappingValidForLine(
  catalog: CatalogCache,
  productId: string,
  line: OrderDraftLine,
): Promise<boolean> {
  const product = await catalog.findProductById(productId);
  if (!product) return false;
  return scoreNameMatch(line.name, product.title) >= getAutoMatchThreshold();
}

async function tryDbMapping(
  tenantId: string,
  line: OrderDraftLine,
  catalog: CatalogCache | undefined,
  name: string,
  sku: string | undefined,
  codeCandidates: string[],
): Promise<ResolvedProductLine | null> {
  const byName = await prisma.productMapping.findFirst({
    where: { tenantId, localName: { equals: name, mode: "insensitive" } },
  });
  
  if (byName?.bizimhesapProductId) {
    if (catalog) {
      const valid = await isDbMappingValidForLine(catalog, byName.bizimhesapProductId, line);
      if (!valid) return null;
    }
    return enrichFromCatalog(catalog, byName.bizimhesapProductId, {
      productId: byName.bizimhesapProductId,
      name,
      sku,
      source: "db",
      quantity: line.qty || 1
    });
  }
  return null;
}

export async function resolveProductLine(
  tenantId: string,
  line: OrderDraftLine,
  catalog?: CatalogCache,
  lineIndex = 0,
  manualProductId?: string,
): Promise<ResolvedProductLine> {
  const name = line.name.trim();
  const sku = line.sku?.trim();
  const codeCandidates = extractLineCodeCandidates(line);
  const quantity = line.qty || 1; // Fişten gelen gerçek adedi yakala!

  if (manualProductId) {
    return enrichFromCatalog(catalog, manualProductId, {
      productId: manualProductId,
      name,
      sku,
      source: "manual",
      quantity
    });
  }

  let catalogSuggestion: MatchSuggestion | undefined;

  if (catalog) {
    const result = await searchProductInCatalog(catalog, line, lineIndex);
    if (result.matched) {
      await learnProductMapping(tenantId, line, result.matched);
      const meta = mapCatalogProductToMeta(result.matched, name);
      return {
        productId: result.matched.id,
        name,
        sku,
        ...meta,
        matchScore: result.matchScore,
        source: "catalog",
        quantity
      };
    }
    if (result.suggestion) {
      catalogSuggestion = result.suggestion;
    }
  }

  const dbResolved = await tryDbMapping(tenantId, line, catalog, name, sku, codeCandidates);
  if (dbResolved) return { ...dbResolved, quantity };

  // BURASI KRİTİK: Eğer katalogda ve DB'de ürün bulunamazsa, Railway'e girdiğimiz Fallback Ürünü devreye al!
  const fallbackProductId = process.env.BIZIMHESAP_FALLBACK_PRODUCT_ID;
  if (fallbackProductId) {
    return {
      productId: fallbackProductId,
      name,
      sku,
      bizimhesapTitle: "Tanımsız WhatsApp Ürünü",
      invoiceLineNote: `Orijinal Fiş Adı: ${name}`,
      source: "none",
      quantity,
      suggestion: catalogSuggestion
    };
  }

  return { name, sku, source: "none", quantity, suggestion: catalogSuggestion };
}

export async function resolveProductId(
  tenantId: string,
  line: OrderDraftLine,
): Promise<string | undefined> {
  const resolved = await resolveProductLine(tenantId, line);
  return resolved.productId;
}