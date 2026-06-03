import { prisma } from "../../db/client.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import type { CatalogCache, CatalogProduct } from "./catalog.js";
import {
  catalogProductToInvoiceMeta,
  searchProductInCatalog,
} from "./catalog.js";
import {
  extractLineCodeCandidates,
  lineContainsProductCode,
} from "./extract-codes.js";
import { getAutoMatchThreshold, normalizeCode, scoreNameMatch } from "./score.js";
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
}

async function enrichFromCatalog(
  catalog: CatalogCache | undefined,
  productId: string,
  partial: ResolvedProductLine,
): Promise<ResolvedProductLine> {
  if (!catalog) return partial;
  const product = await catalog.findProductById(productId);
  if (!product) return partial;
  const meta = catalogProductToInvoiceMeta(product);
  return { ...partial, ...meta };
}

async function learnProductMapping(
  tenantId: string,
  line: OrderDraftLine,
  product: CatalogProduct,
): Promise<void> {
  const localName = line.name.trim();
  const localSku =
    product.codes.find(
      (c) =>
        c !== product.id &&
        normalizeCode(c) !== normalizeCode(product.title),
    ) ?? null;

  await prisma.productMapping.upsert({
    where: {
      tenantId_localName: { tenantId, localName },
    },
    create: {
      tenantId,
      localName,
      localSku,
      bizimhesapProductId: product.id,
    },
    update: {
      bizimhesapProductId: product.id,
      ...(localSku ? { localSku } : {}),
    },
  });

  if (localSku) {
    const existingSku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku },
    });
    if (!existingSku) {
      try {
        await prisma.productMapping.create({
          data: {
            tenantId,
            localName: `${localName} [${localSku}]`,
            localSku,
            bizimhesapProductId: product.id,
          },
        });
      } catch {
        // unique conflict on local_name — ignore
      }
    }
  }
}

/** Stale DB kaydını ele — ürün kodu veya isim benzerliği doğrulanmalı. */
export async function isDbMappingValidForLine(
  catalog: CatalogCache,
  productId: string,
  line: OrderDraftLine,
): Promise<boolean> {
  const product = await catalog.findProductById(productId);
  if (!product) return false;

  const codes = extractLineCodeCandidates(line);
  const codeMatch = codes.some((c) =>
    product.codes.some((pc) => normalizeCode(pc) === normalizeCode(c)),
  );
  if (codeMatch) return true;
  if (lineContainsProductCode(line.name, product.title)) return true;

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
  const attempts: Array<{ productId: string; sku?: string }> = [];

  for (const code of codeCandidates) {
    const bySku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku: code },
    });
    if (bySku?.bizimhesapProductId) {
      attempts.push({ productId: bySku.bizimhesapProductId, sku: code });
    }

    const bySkuName = await prisma.productMapping.findFirst({
      where: {
        tenantId,
        localName: { equals: code, mode: "insensitive" },
      },
    });
    if (bySkuName?.bizimhesapProductId) {
      attempts.push({ productId: bySkuName.bizimhesapProductId, sku: code });
    }
  }

  if (sku) {
    const bySku = await prisma.productMapping.findFirst({
      where: { tenantId, localSku: sku },
    });
    if (bySku?.bizimhesapProductId) {
      attempts.push({ productId: bySku.bizimhesapProductId, sku });
    }
  }

  const byName = await prisma.productMapping.findFirst({
    where: {
      tenantId,
      localName: { equals: name, mode: "insensitive" },
    },
  });
  if (byName?.bizimhesapProductId) {
    attempts.push({ productId: byName.bizimhesapProductId, sku });
  }

  for (const attempt of attempts) {
    if (catalog) {
      const valid = await isDbMappingValidForLine(catalog, attempt.productId, line);
      if (!valid) continue;
    }
    return enrichFromCatalog(catalog, attempt.productId, {
      productId: attempt.productId,
      name,
      sku: attempt.sku ?? sku,
      source: "db",
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

  if (manualProductId) {
    return enrichFromCatalog(catalog, manualProductId, {
      productId: manualProductId,
      name,
      sku,
      source: "manual",
    });
  }

  let catalogSuggestion: MatchSuggestion | undefined;

  if (catalog) {
    const result = await searchProductInCatalog(catalog, line, lineIndex);
    if (result.matched) {
      await learnProductMapping(tenantId, line, result.matched);
      const meta = catalogProductToInvoiceMeta(result.matched);
      return {
        productId: result.matched.id,
        name,
        sku,
        ...meta,
        matchScore: result.matchScore,
        source: "catalog",
      };
    }
    if (result.suggestion) {
      catalogSuggestion = result.suggestion;
    }
  }

  const dbResolved = await tryDbMapping(
    tenantId,
    line,
    catalog,
    name,
    sku,
    codeCandidates,
  );
  if (dbResolved) return dbResolved;

  if (catalogSuggestion) {
    return { name, sku, source: "none", suggestion: catalogSuggestion };
  }

  return { name, sku, source: "none" };
}

/** @deprecated Use resolveProductLine */
export async function resolveProductId(
  tenantId: string,
  line: OrderDraftLine,
): Promise<string | undefined> {
  const resolved = await resolveProductLine(tenantId, line);
  return resolved.productId;
}
