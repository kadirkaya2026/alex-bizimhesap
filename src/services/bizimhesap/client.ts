import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { BizimhesapAddInvoiceResponse } from "./types.js";

export async function bizimhesapPost<T>(
  path: string,
  body: unknown,
  apiKey: string,
): Promise<T> {
  const baseUrl = getEnv().BIZIMHESAP_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    logger.error({ status: response.status, text }, "Bizimhesap non-JSON response");
    throw new Error(`Bizimhesap API yanıtı okunamadı (${response.status})`);
  }

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Bizimhesap HTTP error");
    throw new Error(`Bizimhesap HTTP ${response.status}`);
  }

  return data;
}

export async function postAddInvoiceRaw(
  payload: unknown,
  apiKey: string,
): Promise<BizimhesapAddInvoiceResponse> {
  return bizimhesapPost<BizimhesapAddInvoiceResponse>(
    "/addinvoice",
    payload,
    apiKey,
  );
}
