import { listCustomers } from "../bizimhesap/customers.js";
import { listProducts } from "../bizimhesap/products.js";
import { logger } from "../../lib/logger.js";
import type { OrderDraft, OrderDraftLine } from "../parser/order-draft.schema.js";
import { extractLineCodeCandidates } from "./extract-codes.js";
import { normalizeMatchText, pickNumber, pickString } from "./normalize.js";
import {
  AUTO_MATCH_THRESHOLD,
  normalizeCode,
  normalizePhone,
  pickBestCandidate,
  scoreCodeMatch,
  scoreNameMatch,
  SUGGESTION_THRESHOLD,
  type ScoredCandidate,
} from "./score.js";
import type { MatchSuggestion } from "./types.js";

const CUSTOMER_ID_KEYS = [
  "customerId",
  "CustomerId",
  "id",
  "ID",
  "guid",
  "Guid",
];
const PRODUCT_ID_KEYS = [
  "productId",
  "ProductId",
  "id",
  "ID",
  "guid",
  "Guid",
];
const TITLE_KEYS = [
  "title",
  "Title",
  "name",
  "Name",
  "customerName",
  "productName",
  "unvan",
  "Unvan",
];
const BARCODE_KEYS = [
  "barcode",
  "Barcode",
  "sku",
  "SKU",
  "code",
  "Code",
  "barkod",
  "Barkod",
];
const TAX_NO_KEYS = [
  "taxNo",
  "TaxNo",
  "taxno",
  "vergiNo",
  "VergiNo",
  "tcNo",
  "TcNo",
];
const PHONE_KEYS = ["phone", "Phone", "gsm", "GSM", "telefon", "Telefon"];
const EXTRA_CODE_KEYS = [
  "stokKodu",
  "StokKodu",
  "stockCode",
  "StockCode",
  "model",
  "Model",
  "modelCode",
  "ModelCode",
  "productCode",
  "ProductCode",
];

export interface CatalogCustomer {
  id: string;
  title: string;
  taxNo?: string;
  phone?: string;
}

export interface CatalogProduct {
  id: string;
  title: string;
  codes: string[];
}

export interface CatalogSearchResult<T> {
  matched: T | null;
  suggestion: MatchSuggestion | null;
}

function collectCodes(record: Record<string, unknown>, productId: string): string[] {
  const codes = new Set<string>();
  for (const key of [...BARCODE_KEYS, ...EXTRA_CODE_KEYS, ...PRODUCT_ID_KEYS]) {
    const val = pickString(record, [key]);
    if (val) codes.add(val);
  }
  codes.add(productId);
  return [...codes].filter((c) => normalizeCode(c).length >= 2);
}

export function recordFieldNames(record: Record<string, unknown>): string[] {
  return Object.keys(record);
}

export interface CatalogStats {
  rawCustomerCount: number;
  rawProductCount: number;
  parsedCustomers: number;
  parsedProducts: number;
}

function pickFirstStringField(
  record: Record<string, unknown>,
  predicate: (key: string) => boolean,
): string | undefined {
  for (const [key, val] of Object.entries(record)) {
    if (!predicate(key)) continue;
    if (val != null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return undefined;
}

export class CatalogCache {
  private customers: CatalogCustomer[] | null = null;
  private products: CatalogProduct[] | null = null;
  private codeIndex: Map<string, CatalogProduct> | null = null;
  private rawCustomerCount = 0;
  private rawProductCount = 0;

  constructor(
    private readonly firmId: string,
    private readonly apiKey: string,
  ) {}

  getStats(): CatalogStats {
    return {
      rawCustomerCount: this.rawCustomerCount,
      rawProductCount: this.rawProductCount,
      parsedCustomers: this.customers?.length ?? 0,
      parsedProducts: this.products?.length ?? 0,
    };
  }

  isEmpty(): boolean {
    const stats = this.getStats();
    return stats.parsedCustomers === 0 && stats.parsedProducts === 0;
  }

  async getCustomers(): Promise<CatalogCustomer[]> {
    if (!this.customers) {
      const raw = await listCustomers(this.firmId, this.apiKey);
      this.rawCustomerCount = raw.length;
      this.customers = raw
        .map(normalizeCustomerRecord)
        .filter((c): c is CatalogCustomer => Boolean(c));
      if (raw.length > 0 && this.customers.length === 0) {
        logger.warn(
          { rawCount: raw.length, sampleFields: recordFieldNames(raw[0]!) },
          "Bizimhesap cari kayıtları parse edilemedi — alan adlarını kontrol edin",
        );
      }
    }
    return this.customers;
  }

  async getProducts(): Promise<CatalogProduct[]> {
    if (!this.products) {
      const raw = await listProducts(this.firmId, this.apiKey);
      this.rawProductCount = raw.length;
      this.products = raw
        .map(normalizeProductRecord)
        .filter((p): p is CatalogProduct => Boolean(p));
      if (raw.length > 0 && this.products.length === 0) {
        logger.warn(
          { rawCount: raw.length, sampleFields: recordFieldNames(raw[0]!) },
          "Bizimhesap ürün kayıtları parse edilemedi — alan adlarını kontrol edin",
        );
      }
      this.buildCodeIndex();
    }
    return this.products;
  }

  private buildCodeIndex(): void {
    this.codeIndex = new Map();
    for (const product of this.products ?? []) {
      for (const code of product.codes) {
        const key = normalizeCode(code);
        if (key && !this.codeIndex.has(key)) {
          this.codeIndex.set(key, product);
        }
      }
    }
  }

  async findProductByCode(code: string): Promise<CatalogProduct | null> {
    await this.getProducts();
    return this.codeIndex?.get(normalizeCode(code)) ?? null;
  }

  async findCustomerById(id: string): Promise<CatalogCustomer | null> {
    const customers = await this.getCustomers();
    return customers.find((c) => c.id === id) ?? null;
  }
}

export function normalizeCustomerRecord(
  record: Record<string, unknown>,
): CatalogCustomer | null {
  let id = pickString(record, CUSTOMER_ID_KEYS);
  let title = pickString(record, TITLE_KEYS);

  if (!id) {
    id = pickFirstStringField(
      record,
      (k) => /(?:^|[A-Z])id$/i.test(k) || /^guid$/i.test(k),
    );
  }
  if (!title) {
    title = pickFirstStringField(record, (k) =>
      /title|name|unvan|firma|company|musteri/i.test(k),
    );
  }

  if (!id || !title) return null;
  return {
    id,
    title,
    taxNo: pickString(record, TAX_NO_KEYS),
    phone: pickString(record, PHONE_KEYS),
  };
}

export function normalizeProductRecord(
  record: Record<string, unknown>,
): CatalogProduct | null {
  let id = pickString(record, PRODUCT_ID_KEYS);
  let title = pickString(record, TITLE_KEYS);

  if (!id) {
    id = pickFirstStringField(
      record,
      (k) => /(?:^|[A-Z])id$/i.test(k) || /^guid$/i.test(k),
    );
  }
  if (!title) {
    title = pickFirstStringField(record, (k) =>
      /title|name|unvan|stok|product|urun/i.test(k),
    );
  }

  if (!id || !title) return null;
  return {
    id,
    title,
    codes: collectCodes(record, id),
  };
}

function toSuggestion<T extends { id: string; title: string }>(
  candidate: ScoredCandidate<T>,
  commandPrefix: string,
): MatchSuggestion {
  return {
    id: candidate.item.id,
    label: candidate.item.title,
    score: candidate.score,
    reason: candidate.reason,
    commandHint: `${commandPrefix}${candidate.item.id}`,
  };
}

export async function searchCustomerInCatalog(
  cache: CatalogCache,
  draft: OrderDraft,
): Promise<CatalogSearchResult<CatalogCustomer>> {
  const customers = await cache.getCustomers();
  const candidates: ScoredCandidate<CatalogCustomer>[] = [];

  const taxNo = draft.taxNo?.trim();
  const pdfPhone = draft.customerPhone?.trim();

  for (const customer of customers) {
    if (taxNo && customer.taxNo?.trim() === taxNo) {
      return {
        matched: customer,
        suggestion: null,
      };
    }

    if (pdfPhone && customer.phone) {
      if (normalizePhone(pdfPhone) === normalizePhone(customer.phone)) {
        return {
          matched: customer,
          suggestion: null,
        };
      }
    }

    const nameScore = scoreNameMatch(draft.customerName, customer.title);
    if (nameScore >= SUGGESTION_THRESHOLD) {
      candidates.push({
        item: customer,
        score: nameScore,
        reason: "isim benzerliği",
      });
    }
  }

  const best = pickBestCandidate(candidates);
  if (!best) {
    return { matched: null, suggestion: null };
  }

  if (best.score >= AUTO_MATCH_THRESHOLD) {
    return { matched: best.item, suggestion: null };
  }

  return {
    matched: null,
    suggestion: toSuggestion(best, "CARI:"),
  };
}

export async function searchProductInCatalog(
  cache: CatalogCache,
  line: OrderDraftLine,
  lineIndex: number,
): Promise<CatalogSearchResult<CatalogProduct>> {
  await cache.getProducts();
  const codeCandidates = extractLineCodeCandidates(line);

  for (const code of codeCandidates) {
    const byCode = await cache.findProductByCode(code);
    if (byCode) {
      return { matched: byCode, suggestion: null };
    }
  }

  const products = await cache.getProducts();
  const candidates: ScoredCandidate<CatalogProduct>[] = [];

  for (const product of products) {
    for (const code of codeCandidates) {
      for (const productCode of product.codes) {
        const codeScore = scoreCodeMatch(code, productCode);
        if (codeScore >= SUGGESTION_THRESHOLD) {
          candidates.push({
            item: product,
            score: codeScore,
            reason: `kod eşleşmesi (${code})`,
          });
        }
      }
    }

    const nameScore = scoreNameMatch(line.name, product.title);
    if (nameScore >= SUGGESTION_THRESHOLD) {
      candidates.push({
        item: product,
        score: nameScore,
        reason: "isim benzerliği",
      });
    }
  }

  const best = pickBestCandidate(candidates);
  if (!best) {
    return { matched: null, suggestion: null };
  }

  const skuHint = line.sku?.trim() || codeCandidates[0];
  const commandPrefix =
    lineIndex === 0 ? "SKU:" : `SKU${lineIndex + 1}:`;
  const hintCode =
    codeCandidates.find((c) =>
      best.item.codes.some((pc) => normalizeCode(pc) === normalizeCode(c)),
    ) ??
    best.item.codes.find((c) => c !== best.item.id) ??
    skuHint ??
    best.item.id;

  if (best.score >= AUTO_MATCH_THRESHOLD) {
    return { matched: best.item, suggestion: null };
  }

  return {
    matched: null,
    suggestion: {
      id: best.item.id,
      label: best.item.title,
      score: best.score,
      reason: best.reason,
      commandHint: `${commandPrefix}${hintCode}`,
    },
  };
}

/** @deprecated Use searchCustomerInCatalog */
export async function findCustomerInCatalog(
  cache: CatalogCache,
  draft: OrderDraft,
): Promise<CatalogCustomer | null> {
  const result = await searchCustomerInCatalog(cache, draft);
  return result.matched;
}

/** @deprecated Use searchProductInCatalog */
export async function findProductInCatalog(
  cache: CatalogCache,
  line: OrderDraftLine,
): Promise<CatalogProduct | null> {
  const result = await searchProductInCatalog(cache, line, 0);
  return result.matched;
}

/** Depo stok kaydından ürün ID ve miktar okur. */
export function extractInventoryStock(
  record: Record<string, unknown>,
): { productId: string; available: number } | null {
  const productId = pickString(record, PRODUCT_ID_KEYS);
  const available = pickNumber(record, [
    "quantity",
    "Quantity",
    "stock",
    "Stock",
    "available",
    "Available",
    "miktar",
    "Miktar",
    "amount",
  ]);
  if (!productId || available == null) return null;
  return { productId, available };
}

export function getAllProductCodes(product: CatalogProduct): string[] {
  return product.codes;
}
