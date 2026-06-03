import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { BizimhesapAddInvoiceResponse } from "./types.js";

function resolveUrl(path: string): string {
  const baseUrl = getEnv().BIZIMHESAP_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeListResponse(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data as Record<string, unknown>[];
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of [
      "data",
      "items",
      "results",
      "customers",
      "products",
      "warehouses",
      "inventory",
      "abstract",
    ]) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested as Record<string, unknown>[];
      }
    }
  }
  return [];
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    logger.error({ status: response.status, text }, "Bizimhesap non-JSON response");
    throw new Error(`Bizimhesap API yanıtı okunamadı (${response.status})`);
  }
}

/** GET uçları: `token` header (Products, Customers, Warehouses, Inventory, Abstract). */
export async function bizimhesapGet<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      token: apiKey,
    },
  });

  const data = await parseJsonResponse<T>(response);

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Bizimhesap GET HTTP error");
    throw new Error(`Bizimhesap HTTP ${response.status}`);
  }

  return data;
}

/**
 * POST uçları (AddInvoice, CancelInvoice, AddCustomer, AddProduct).
 * Resmi dokümanda header zorunluluğu yok; mevcut AddInvoice akışı Bearer ile çalışıyor.
 */
export async function bizimhesapPost<T>(
  path: string,
  body: unknown,
  apiKey: string,
): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await parseJsonResponse<T>(response);

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Bizimhesap POST HTTP error");
    throw new Error(`Bizimhesap HTTP ${response.status}`);
  }

  return data;
}

/**
 * POST /addinvoice — resmi dokümanda header yok; kimlik doğrulama body'deki firmId ile.
 */
export async function postAddInvoiceRaw(
  payload: unknown,
): Promise<BizimhesapAddInvoiceResponse> {
  const response = await fetch(resolveUrl("/addinvoice"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse<BizimhesapAddInvoiceResponse>(response);

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Bizimhesap addinvoice HTTP error");
    throw new Error(`Bizimhesap HTTP ${response.status}`);
  }

  return data;
}
