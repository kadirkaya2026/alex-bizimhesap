import { listCustomers } from "../bizimhesap/customers.js";
import { listProducts } from "../bizimhesap/products.js";
import type { OrderDraft, OrderDraftLine } from "../parser/order-draft.schema.js";
import { normalizeMatchText, pickNumber, pickString } from "./normalize.js";

const CUSTOMER_ID_KEYS = ["customerId", "CustomerId", "id", "ID", "guid", "Guid"];
const PRODUCT_ID_KEYS = ["productId", "ProductId", "id", "ID", "guid", "Guid"];
const TITLE_KEYS = ["title", "Title", "name", "Name", "customerName", "productName"];
const BARCODE_KEYS = ["barcode", "Barcode", "sku", "SKU", "code", "Code", "barkod"];
const TAX_NO_KEYS = ["taxNo", "TaxNo", "taxno", "vergiNo", "VergiNo", "tcNo"];

export interface CatalogCustomer {
  id: string;
  title: string;
  taxNo?: string;
}

export interface CatalogProduct {
  id: string;
  title: string;
  barcode?: string;
}

export class CatalogCache {
  private customers: CatalogCustomer[] | null = null;
  private products: CatalogProduct[] | null = null;

  constructor(private readonly apiKey: string) {}

  async getCustomers(): Promise<CatalogCustomer[]> {
    if (!this.customers) {
      const raw = await listCustomers(this.apiKey);
      this.customers = raw.map(normalizeCustomerRecord).filter((c): c is CatalogCustomer => Boolean(c));
    }
    return this.customers;
  }

  async getProducts(): Promise<CatalogProduct[]> {
    if (!this.products) {
      const raw = await listProducts(this.apiKey);
      this.products = raw.map(normalizeProductRecord).filter((p): p is CatalogProduct => Boolean(p));
    }
    return this.products;
  }
}

export function normalizeCustomerRecord(
  record: Record<string, unknown>,
): CatalogCustomer | null {
  const id = pickString(record, CUSTOMER_ID_KEYS);
  const title = pickString(record, TITLE_KEYS);
  if (!id || !title) return null;
  return {
    id,
    title,
    taxNo: pickString(record, TAX_NO_KEYS),
  };
}

export function normalizeProductRecord(
  record: Record<string, unknown>,
): CatalogProduct | null {
  const id = pickString(record, PRODUCT_ID_KEYS);
  const title = pickString(record, TITLE_KEYS);
  if (!id || !title) return null;
  return {
    id,
    title,
    barcode: pickString(record, BARCODE_KEYS),
  };
}

export async function findCustomerInCatalog(
  cache: CatalogCache,
  draft: OrderDraft,
): Promise<CatalogCustomer | null> {
  const customers = await cache.getCustomers();
  const taxNo = draft.taxNo?.trim();
  if (taxNo) {
    const byTax = customers.find((c) => c.taxNo?.trim() === taxNo);
    if (byTax) return byTax;
  }

  const normalizedName = normalizeMatchText(draft.customerName);
  const byName = customers.find(
    (c) => normalizeMatchText(c.title) === normalizedName,
  );
  return byName ?? null;
}

export async function findProductInCatalog(
  cache: CatalogCache,
  line: OrderDraftLine,
): Promise<CatalogProduct | null> {
  const products = await cache.getProducts();
  const sku = line.sku?.trim();
  if (sku) {
    const bySku = products.find(
      (p) => p.barcode?.trim() === sku || p.id === sku,
    );
    if (bySku) return bySku;
  }

  const normalizedName = normalizeMatchText(line.name);
  const byName = products.find(
    (p) => normalizeMatchText(p.title) === normalizedName,
  );
  return byName ?? null;
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
