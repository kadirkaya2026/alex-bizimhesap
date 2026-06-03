import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { getWarehouseInventory, listWarehouses } from "../bizimhesap/products.js";
import type { OrderDraftLine } from "../parser/order-draft.schema.js";
import type { ResolvedTenant } from "../tenant/resolve.js";
import { CatalogCache, extractInventoryStock } from "./catalog.js";
import type { ResolvedCustomer } from "./customer.js";
import { resolveCustomerMapping } from "./customer.js";
import type { ResolvedProductLine } from "./product.js";
import { resolveProductLine } from "./product.js";

export type { MatchSource } from "./customer.js";
export type { ResolvedCustomer } from "./customer.js";
export type { ResolvedProductLine } from "./product.js";

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
  customer: Awaited<ReturnType<typeof resolveCustomerMapping>>;
  lines: ResolvedLine[];
  stockWarnings: StockWarning[];
  blockingErrors: string[];
}

export interface ResolvedOrderSnapshot {
  customer: ResolvedOrder["customer"];
  lines: ResolvedLine[];
  stockWarnings: StockWarning[];
  blockingErrors: string[];
}

function buildBlockingErrors(
  customer: ResolvedOrder["customer"],
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
    logger.warn({ warehouseId: id, warehouseName: name }, "Varsayılan depo otomatik seçildi — BIZIMHESAP_DEFAULT_WAREHOUSE_ID ayarlayın");
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
    logger.warn({ error, warehouseId: warehouse.warehouseId }, "Depo stok verisi alınamadı");
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
  draft: { lines: OrderDraftLine[]; customerName: string; taxNo?: string | null },
  catalog?: CatalogCache,
): Promise<ResolvedOrder> {
  let cache: CatalogCache | undefined;
  if (catalog) {
    cache = catalog;
  } else if (
    tenant.bizimhesapApiKey &&
    tenant.bizimhesapApiKey !== "REPLACE_API_KEY"
  ) {
    cache = new CatalogCache(tenant.bizimhesapApiKey);
  }

  let customer: Awaited<ReturnType<typeof resolveCustomerMapping>>;
  try {
    customer = await resolveCustomerMapping(
      tenant.tenantId,
      draft as Parameters<typeof resolveCustomerMapping>[1],
      cache,
    );
  } catch (error) {
    logger.warn({ error }, "Cari eşleştirme hatası — katalog atlandı");
    customer = await resolveCustomerMapping(
      tenant.tenantId,
      draft as Parameters<typeof resolveCustomerMapping>[1],
    );
  }

  const lines: ResolvedLine[] = [];
  for (let i = 0; i < draft.lines.length; i++) {
    const line = draft.lines[i]!;
    let resolved: Awaited<ReturnType<typeof resolveProductLine>>;
    try {
      resolved = await resolveProductLine(tenant.tenantId, line, cache);
    } catch (error) {
      logger.warn({ error, line: line.name }, "Ürün eşleştirme hatası — katalog atlandı");
      resolved = await resolveProductLine(tenant.tenantId, line);
    }
    lines.push({
      ...resolved,
      index: i,
      qty: line.qty,
    });
  }

  const stockWarnings = await checkStockWarnings(tenant, lines);
  const blockingErrors = buildBlockingErrors(customer, lines);

  return {
    customer,
    lines,
    stockWarnings,
    blockingErrors,
  };
}

export function toResolvedOrderSnapshot(resolved: ResolvedOrder): ResolvedOrderSnapshot {
  return {
    customer: resolved.customer,
    lines: resolved.lines,
    stockWarnings: resolved.stockWarnings,
    blockingErrors: resolved.blockingErrors,
  };
}
