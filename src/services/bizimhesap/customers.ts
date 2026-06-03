import { bizimhesapGetList, bizimhesapPost } from "./client.js";
import type {
  BizimhesapAddCustomerPayload,
  BizimhesapCustomerRecord,
  BizimhesapMutationResponse,
} from "./types.js";

export async function listCustomers(
  firmId: string,
  apiKey: string,
): Promise<BizimhesapCustomerRecord[]> {
  return bizimhesapGetList("/customers", { firmId, apiKey });
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
  firmId: string,
  apiKey: string,
): Promise<BizimhesapCustomerRecord[]> {
  const encodedId = encodeURIComponent(customerId);
  return bizimhesapGetList(`/abstract/${encodedId}`, { firmId, apiKey });
}
