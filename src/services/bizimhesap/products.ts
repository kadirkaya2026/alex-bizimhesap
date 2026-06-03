import { bizimhesapGetList, bizimhesapPost } from "./client.js";
import type {
  BizimhesapAddProductPayload,
  BizimhesapInventoryRecord,
  BizimhesapMutationResponse,
  BizimhesapProductRecord,
  BizimhesapWarehouseRecord,
} from "./types.js";

export async function listProducts(
  firmId: string,
  apiKey: string,
): Promise<BizimhesapProductRecord[]> {
  return bizimhesapGetList("/products", { firmId, apiKey });
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
  firmId: string,
  apiKey: string,
): Promise<BizimhesapWarehouseRecord[]> {
  return bizimhesapGetList("/warehouses", { firmId, apiKey });
}

export async function getWarehouseInventory(
  warehouseId: string,
  firmId: string,
  apiKey: string,
): Promise<BizimhesapInventoryRecord[]> {
  const encodedId = encodeURIComponent(warehouseId);
  return bizimhesapGetList(`/inventory/${encodedId}`, { firmId, apiKey });
}

/** Ürün kataloğunu Bizimhesap'tan çeker (Faz 2+ eşleme için). */
export async function syncProductCatalog(
  firmId: string,
  apiKey: string,
): Promise<BizimhesapProductRecord[]> {
  return listProducts(firmId, apiKey);
}
