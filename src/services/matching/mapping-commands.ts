import { prisma } from "../../db/client.js";
import type { OrderDraft } from "../parser/order-draft.schema.js";
import type { ResolvedTenant } from "../tenant/resolve.js";
import { CatalogCache } from "./catalog.js";
import type { ManualOverrides } from "./types.js";

export type MappingCommand =
  | { type: "cari"; value: string }
  | { type: "sku"; lineIndex: number; value: string }
  | { type: "yeniden" };

export function parseMappingCommand(text: string): MappingCommand | null {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  if (upper === "YENIDEN" || upper === "YENİDEN") {
    return { type: "yeniden" };
  }

  const cariMatch = trimmed.match(/^CARI\s*:\s*(.+)$/i);
  if (cariMatch?.[1]) {
    return { type: "cari", value: cariMatch[1].trim() };
  }

  const skuMatch = trimmed.match(/^SKU(\d+)?\s*:\s*(.+)$/i);
  if (skuMatch) {
    const lineIndex = skuMatch[1] ? Number.parseInt(skuMatch[1], 10) - 1 : 0;
    const value = skuMatch[2]?.trim();
    if (value && lineIndex >= 0) {
      return { type: "sku", lineIndex, value };
    }
  }

  return null;
}

export function isMappingCommand(text: string): boolean {
  return parseMappingCommand(text) !== null;
}

async function resolveCustomerIdFromInput(
  cache: CatalogCache,
  value: string,
): Promise<{ customerId: string; title: string } | null> {
  const byId = await cache.findCustomerById(value);
  if (byId) {
    return { customerId: byId.id, title: byId.title };
  }

  const customers = await cache.getCustomers();
  const lower = value.toLowerCase();
  const byName = customers.find((c) => c.title.toLowerCase() === lower);
  if (byName) {
    return { customerId: byName.id, title: byName.title };
  }

  return null;
}

async function resolveProductIdFromInput(
  cache: CatalogCache,
  value: string,
): Promise<{ productId: string; title: string; code?: string } | null> {
  const byCode = await cache.findProductByCode(value);
  if (byCode) {
    return { productId: byCode.id, title: byCode.title, code: value };
  }

  const products = await cache.getProducts();
  const byId = products.find((p) => p.id === value);
  if (byId) {
    return { productId: byId.id, title: byId.title };
  }

  return null;
}

export async function applyMappingCommand(
  tenant: ResolvedTenant,
  draft: OrderDraft,
  command: MappingCommand,
  existingOverrides?: ManualOverrides,
): Promise<{ overrides: ManualOverrides; message: string } | { error: string }> {
  const cache = new CatalogCache(tenant.bizimhesapFirmId, tenant.bizimhesapApiKey);

  try {
    await cache.getCustomers();
    await cache.getProducts();
  } catch {
    return {
      error:
        "Bizimhesap kataloğu yüklenemedi — API/auth kontrol edilmeli.",
    };
  }

  const stats = cache.getStats();
  if (stats.parsedCustomers === 0 && stats.parsedProducts === 0) {
    return {
      error:
        "Bizimhesap kataloğu boş — CARI:6761 yazsanız bile liste yüklenemedi. Önce API/auth düzeltilmeli.",
    };
  }

  const overrides: ManualOverrides = {
    customerId: existingOverrides?.customerId,
    productIdsByLine: { ...existingOverrides?.productIdsByLine },
  };

  if (command.type === "cari") {
    const resolved = await resolveCustomerIdFromInput(cache, command.value);
    if (!resolved) {
      return { error: `Cari bulunamadı: ${command.value}` };
    }

    overrides.customerId = resolved.customerId;
    await prisma.customerMapping.upsert({
      where: {
        tenantId_localName: {
          tenantId: tenant.tenantId,
          localName: draft.customerName.trim(),
        },
      },
      create: {
        tenantId: tenant.tenantId,
        localName: draft.customerName.trim(),
        bizimhesapCustomerId: resolved.customerId,
      },
      update: { bizimhesapCustomerId: resolved.customerId },
    });

    return {
      overrides,
      message: `Cari eşleştirildi: ${resolved.title} (#${resolved.customerId})`,
    };
  }

  if (command.type === "sku") {
    const line = draft.lines[command.lineIndex];
    if (!line) {
      return { error: `Geçersiz satır numarası: ${command.lineIndex + 1}` };
    }

    const resolved = await resolveProductIdFromInput(cache, command.value);
    if (!resolved) {
      return { error: `Ürün/kod bulunamadı: ${command.value}` };
    }

    overrides.productIdsByLine ??= {};
    overrides.productIdsByLine[command.lineIndex] = resolved.productId;

    const localSku = command.value.trim();
    await prisma.productMapping.upsert({
      where: {
        tenantId_localName: {
          tenantId: tenant.tenantId,
          localName: line.name.trim(),
        },
      },
      create: {
        tenantId: tenant.tenantId,
        localName: line.name.trim(),
        localSku,
        bizimhesapProductId: resolved.productId,
      },
      update: {
        bizimhesapProductId: resolved.productId,
        localSku,
      },
    });

    return {
      overrides,
      message: `Satır ${command.lineIndex + 1} eşleştirildi: ${resolved.title} (#${resolved.productId})`,
    };
  }

  return { error: "Bilinmeyen komut" };
}
