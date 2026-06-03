import { bizimhesapGet, bizimhesapPost, normalizeListResponse } from "./client.js";
import type {
  BizimhesapAddProductPayload,
  BizimhesapInventoryRecord,
  BizimhesapMutationResponse,
  BizimhesapProductRecord,
  BizimhesapWarehouseRecord,
} from "./types.js";

export async function listProducts(
  apiKey: string,
): Promise<BizimhesapProductRecord[]> {
  const data = await bizimhesapGet<unknown>("/products", apiKey);
  return normalizeListResponse(data);
}

export async function postAddProduct(
  payload: BizimhesapAddProductPayload,
  apiKey: string,
): Promise<BizimhesapMutationResponse> {
  return bizimhesapPost<BizimhesapMutationResponse>(
    "/addproduct",
    payload,
    apiKey,
  );
}

export async function listWarehouses(
  apiKey: string,
): Promise<BizimhesapWarehouseRecord[]> {
  const data = await bizimhesapGet<unknown>("/warehouses", apiKey);
  return normalizeListResponse(data);
}

export async function getWarehouseInventory(
  warehouseId: string,
  apiKey: string,
): Promise<BizimhesapInventoryRecord[]> {
  const encodedId = encodeURIComponent(warehouseId);
  const data = await bizimhesapGet<unknown>(`/inventory/${encodedId}`, apiKey);
  return normalizeListResponse(data);
}

/** Ürün kataloğunu Bizimhesap'tan çeker (Faz 2+ eşleme için). */
export async function syncProductCatalog(apiKey: string): Promise<BizimhesapProductRecord[]> {
  return listProducts(apiKey);
}
