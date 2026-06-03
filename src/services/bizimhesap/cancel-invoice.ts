import { bizimhesapPost } from "./client.js";
import type {
  BizimhesapCancelInvoicePayload,
  BizimhesapCancelInvoiceResponse,
} from "./types.js";

export async function postCancelInvoice(
  payload: BizimhesapCancelInvoicePayload,
  apiKey: string,
): Promise<BizimhesapCancelInvoiceResponse> {
  return bizimhesapPost<BizimhesapCancelInvoiceResponse>(
    "/cancelinvoice",
    payload,
    apiKey,
  );
}

export function buildCancelInvoicePayload(params: {
  firmId: string;
  guid: string;
}): BizimhesapCancelInvoicePayload {
  return {
    firmId: params.firmId,
    guid: params.guid,
  };
}
