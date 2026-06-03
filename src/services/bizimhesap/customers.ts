import { bizimhesapGet, bizimhesapPost, normalizeListResponse } from "./client.js";
import type {
  BizimhesapAbstractRecord,
  BizimhesapAddCustomerPayload,
  BizimhesapCustomerRecord,
  BizimhesapMutationResponse,
} from "./types.js";

export async function listCustomers(
  apiKey: string,
): Promise<BizimhesapCustomerRecord[]> {
  const data = await bizimhesapGet<unknown>("/customers", apiKey);
  return normalizeListResponse(data);
}

export async function postAddCustomer(
  payload: BizimhesapAddCustomerPayload,
  apiKey: string,
): Promise<BizimhesapMutationResponse> {
  return bizimhesapPost<BizimhesapMutationResponse>(
    "/addcustomer",
    payload,
    apiKey,
  );
}

export async function getCustomerAbstract(
  customerId: string,
  apiKey: string,
): Promise<BizimhesapAbstractRecord[]> {
  const encodedId = encodeURIComponent(customerId);
  const data = await bizimhesapGet<unknown>(`/abstract/${encodedId}`, apiKey);
  return normalizeListResponse(data);
}
