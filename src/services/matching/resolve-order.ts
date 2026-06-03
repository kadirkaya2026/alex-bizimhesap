import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { getWarehouseInventory, listWarehouses } from "../bizimhesap/products.js";
import type { OrderDraft, OrderDraftLine } from "../parser/order-draft.schema.js";
import type { ResolvedTenant } from "../tenant/resolve.js";
import { CatalogCache, extractInventoryStock } from "./catalog.js";
import type { ResolvedCustomer } from "./customer.js";
import { resolveCustomerMapping } from "./customer.js";
import type { ResolvedProductLine } from "./product.js";
import { resolveProductLine } from "./product.js";
import type {
  CustomerSuggestion,
  ManualOverrides,
  ProductSuggestion,
} from "./types.js";

export type { MatchSource } from "./customer.js";
export type { ResolvedCustomer } from "./customer.js";
export type { ResolvedProductLine } from "./product.js";
export type {
  CustomerSuggestion,
  ManualOverrides,
  MatchSuggestion,
  ProductSuggestion,
} from "./types.js";

export interface StockWarning {
  productName: string;
  productId: string;
  requested: number;
  available: number;
  warehouseName?: string;
}

export interface ResolvedLine extends ResolvedProductLine {
  index: number;
  qty: number;
}

export interface ResolvedOrder {
  customer: ResolvedCustomer;
  lines: ResolvedLine[];
  stockWarnings: StockWarning[];
  blockingErrors: string[];
  customerSuggestion?: CustomerSuggestion;
  productSuggestions: ProductSuggestion[];
  manualOverrides?: ManualOverrides;
}

export interface ResolvedOrderSnapshot {
  customer: ResolvedOrder["customer"];
  lines: ResolvedLine[];
  stockWarnings: StockWarning[];
  blockingErrors: string[];
  customerSuggestion?: CustomerSuggestion;
  productSuggestions: ProductSuggestion[];
  manualOverrides?: ManualOverrides;
}

function buildBlockingErrors(
  customer: ResolvedCustomer,
  lines: ResolvedLine[],
): string[] {
  const errors: string[] = [];
  if (!customer.customerId) {
    errors.push(`Cari eşleşmedi: ${customer.title}`);
  }
  for (const line of lines) {
    if (!line.productId) {
      const skuPart = line.sku ? ` (SKU: ${line.sku})` : "";
      errors.push(`Ürün eşleşmedi: ${line.name}${skuPart}`);
    }
  }
  return errors;
}

function collectSuggestions(
  customer: ResolvedCustomer,
  lines: ResolvedLine[],
): {
  customerSuggestion?: CustomerSuggestion;
  productSuggestions: ProductSuggestion[];
} {
  const productSuggestions: ProductSuggestion[] = [];

  for (const line of lines) {
    if (!line.productId && line.suggestion) {
      productSuggestions.push({
        lineIndex: line.index,
        pdfName: line.name,
        sku: line.sku,
        suggestion: line.suggestion,
      });
    }
  }

  const customerSuggestion =
    !customer.customerId && customer.suggestion
      ? {
          pdfName: customer.title,
          suggestion: customer.suggestion,
        }
      : undefined;

  return { customerSuggestion, productSuggestions };
}

async function resolveWarehouseId(
  tenant: ResolvedTenant,
): Promise<{ warehouseId: string; warehouseName?: string } | null> {
  const envWarehouse = getEnv().BIZIMHESAP_DEFAULT_WAREHOUSE_ID?.trim();
  const tenantWarehouse = tenant.defaultWarehouseId?.trim();
  const warehouseId = tenantWarehouse || envWarehouse;

  if (warehouseId) {
    return { warehouseId };
  }

  try {
    const warehouses = await listWarehouses(tenant.bizimhesapApiKey);
    const first = warehouses[0];
    if (!first) {
      logger.warn("Bizimhesap depo listesi boş — stok kontrolü atlandı");
      return null;
    }
    const id = String(
      first.id ?? first.ID ?? first.warehouseId ?? first.WarehouseId ?? "",
    ).trim();
    const name = String(first.title ?? first.name ?? first.Title ?? "").trim();
    if (!id) return null;
    logger.warn(
      { warehouseId: id, warehouseName: name },
      "Varsayılan depo otomatik seçildi — BIZIMHESAP_DEFAULT_WAREHOUSE_ID ayarlayın",
    );
    return { warehouseId: id, warehouseName: name || undefined };
  } catch (error) {
    logger.warn({ error }, "Depo listesi alınamadı — stok kontrolü atlandı");
    return null;
  }
}

async function checkStockWarnings(
  tenant: ResolvedTenant,
  lines: ResolvedLine[],
): Promise<StockWarning[]> {
  const warehouse = await resolveWarehouseId(tenant);
  if (!warehouse) return [];

  let inventory;
  try {
    inventory = await getWarehouseInventory(
      warehouse.warehouseId,
      tenant.bizimhesapApiKey,
    );
  } catch (error) {
    logger.warn(
      { error, warehouseId: warehouse.warehouseId },
      "Depo stok verisi alınamadı",
    );
    return [];
  }

  const stockByProduct = new Map<string, number>();
  for (const row of inventory) {
    const parsed = extractInventoryStock(row);
    if (parsed) {
      stockByProduct.set(parsed.productId, parsed.available);
    }
  }

  const warnings: StockWarning[] = [];
  for (const line of lines) {
    if (!line.productId) continue;
    const available = stockByProduct.get(line.productId);
    if (available == null) continue;
    if (available < line.qty) {
      warnings.push({
        productName: line.name,
        productId: line.productId,
        requested: line.qty,
        available,
        warehouseName: warehouse.warehouseName,
      });
    }
  }
  return warnings;
}

export async function resolveOrderMappings(
  tenant: ResolvedTenant,
  draft: OrderDraft,
  options?: {
    catalog?: CatalogCache;
    manualOverrides?: ManualOverrides;
  },
): Promise<ResolvedOrder> {
  let cache: CatalogCache | undefined;
  if (options?.catalog) {
    cache = options.catalog;
  } else if (
    tenant.bizimhesapApiKey &&
    tenant.bizimhesapApiKey !== "REPLACE_API_KEY"
  ) {
    cache = new CatalogCache(tenant.bizimhesapApiKey);
  }

  const overrides = options?.manualOverrides;

  let customer: ResolvedCustomer;
  try {
    customer = await resolveCustomerMapping(
      tenant.tenantId,
      draft,
      cache,
      overrides?.customerId,
    );
  } catch (error) {
    logger.warn({ error }, "Cari eşleştirme hatası — katalog atlandı");
    customer = await resolveCustomerMapping(
      tenant.tenantId,
      draft,
      undefined,
      overrides?.customerId,
    );
  }

  const lines: ResolvedLine[] = [];
  for (let i = 0; i < draft.lines.length; i++) {
    const line = draft.lines[i]!;
    const manualProductId = overrides?.productIdsByLine?.[i];
    let resolved: ResolvedProductLine;
    try {
      resolved = await resolveProductLine(
        tenant.tenantId,
        line,
        cache,
        i,
        manualProductId,
      );
    } catch (error) {
      logger.warn({ error, line: line.name }, "Ürün eşleştirme hatası — katalog atlandı");
      resolved = await resolveProductLine(
        tenant.tenantId,
        line,
        undefined,
        i,
        manualProductId,
      );
    }
    lines.push({
      ...resolved,
      index: i,
      qty: line.qty,
    });
  }

  const stockWarnings = await checkStockWarnings(tenant, lines);
  const blockingErrors = buildBlockingErrors(customer, lines);
  const { customerSuggestion, productSuggestions } = collectSuggestions(
    customer,
    lines,
  );

  return {
    customer,
    lines,
    stockWarnings,
    blockingErrors,
    customerSuggestion,
    productSuggestions,
    manualOverrides: overrides,
  };
}

export function toResolvedOrderSnapshot(
  resolved: ResolvedOrder,
): ResolvedOrderSnapshot {
  return {
    customer: resolved.customer,
    lines: resolved.lines,
    stockWarnings: resolved.stockWarnings,
    blockingErrors: resolved.blockingErrors,
    customerSuggestion: resolved.customerSuggestion,
    productSuggestions: resolved.productSuggestions,
    manualOverrides: resolved.manualOverrides,
  };
}

export function parseManualOverridesFromMappingJson(
  mappingJson: unknown,
): ManualOverrides | undefined {
  if (!mappingJson || typeof mappingJson !== "object") return undefined;
  const record = mappingJson as Record<string, unknown>;
  const raw = record.manualOverrides;
  if (!raw || typeof raw !== "object") return undefined;
  const mo = raw as Record<string, unknown>;
  const productIdsByLine: Record<number, string> = {};
  const rawProducts = mo.productIdsByLine;
  if (rawProducts && typeof rawProducts === "object") {
    for (const [key, val] of Object.entries(rawProducts)) {
      if (typeof val === "string") {
        productIdsByLine[Number.parseInt(key, 10)] = val;
      }
    }
  }
  return {
    customerId:
      typeof mo.customerId === "string" ? mo.customerId : undefined,
    productIdsByLine:
      Object.keys(productIdsByLine).length > 0 ? productIdsByLine : undefined,
  };
}
