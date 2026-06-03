import { logger } from "../../lib/logger.js";
import type { CatalogCache } from "./catalog.js";
import { catalogProductToInvoiceMeta } from "./catalog.js";
import type { ResolvedCustomer } from "./customer.js";
import type { ResolvedProductLine } from "./product.js";
import { getFallbackCustomerId, getFallbackProductId } from "./smart-mapping.js";

/** Bizimhesap kataloğunda kayıtlı gerçek cari ID mi? */
export async function isKnownCatalogCustomerId(
  cache: CatalogCache | undefined,
  customerId: string,
): Promise<boolean> {
  if (!cache) return false;
  const found = await cache.findCustomerById(customerId);
  return Boolean(found);
}

/** Bizimhesap kataloğunda kayıtlı gerçek stok ID mi? */
export async function isKnownCatalogProductId(
  cache: CatalogCache | undefined,
  productId: string,
): Promise<boolean> {
  if (!cache) return false;
  const found = await cache.findProductById(productId);
  return Boolean(found);
}

/**
 * Cari ID'sini canlı kataloga göre doğrular.
 * Katalogda yoksa (stale/uydurma) ID temizlenir → fallback devreye girer.
 */
export async function sanitizeCustomerId(
  customer: ResolvedCustomer,
  cache?: CatalogCache,
): Promise<ResolvedCustomer> {
  if (!customer.customerId) return customer;

  const fallbackId = getFallbackCustomerId();
  if (fallbackId && customer.customerId === fallbackId) {
    return customer;
  }

  if (!cache) {
    return customer;
  }

  if (await isKnownCatalogCustomerId(cache, customer.customerId)) {
    const found = await cache!.findCustomerById(customer.customerId);
    return {
      ...customer,
      bizimhesapTitle: found?.title ?? customer.bizimhesapTitle,
    };
  }

  logger.warn(
    { customerId: customer.customerId, title: customer.title, source: customer.source },
    "Cari ID katalogda bulunamadı — fallback kullanılacak",
  );

  return {
    ...customer,
    customerId: undefined,
    bizimhesapTitle: undefined,
    matchScore: undefined,
    source: "none",
    suggestion: undefined,
  };
}

/**
 * Ürün ID'sini canlı kataloga göre doğrular; yalnızca gerçek stok kartı ID'leri geçer.
 * Katalogda yoksa temizlenir → BIZIMHESAP_FALLBACK_PRODUCT_ID atanır.
 */
export async function sanitizeProductId(
  line: ResolvedProductLine,
  cache?: CatalogCache,
): Promise<ResolvedProductLine> {
  if (!line.productId) return line;

  const fallbackId = getFallbackProductId();
  if (fallbackId && line.productId === fallbackId) {
    return line;
  }

  if (!cache) {
    return line;
  }

  const inCatalog = await cache.findProductById(line.productId);
  if (inCatalog) {
    const meta = catalogProductToInvoiceMeta(inCatalog);
    return {
      ...line,
      productId: inCatalog.id,
      ...meta,
    };
  }

  logger.warn(
    { productId: line.productId, name: line.name, source: line.source },
    "Ürün ID katalogda bulunamadı — fallback kullanılacak",
  );

  return {
    ...line,
    productId: undefined,
    bizimhesapTitle: undefined,
    bizimhesapBarcode: undefined,
    invoiceLineNote: undefined,
    matchScore: undefined,
    source: "none",
    suggestion: undefined,
  };
}
