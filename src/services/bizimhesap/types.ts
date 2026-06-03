export interface BizimhesapErrorResponse {
  error: string;
}

export interface BizimhesapAddInvoiceResponse extends BizimhesapErrorResponse {
  guid: string;
  url: string;
}

export interface BizimhesapCancelInvoiceResponse extends BizimhesapErrorResponse {
  status: string;
}

export interface BizimhesapMutationResponse extends BizimhesapErrorResponse {
  guid: string;
  message: string;
}

export interface BizimhesapAddInvoicePayload {
  firmId: string;
  invoiceNo?: string;
  invoiceType: number;
  note?: string;
  dates: {
    invoiceDate: string;
    dueDate: string;
    deliveryDate?: string;
  };
  customer: {
    customerId?: string | number;
    title: string;
    address?: string;
    taxOffice?: string;
    taxNo?: string;
    email?: string;
    phone?: string;
  };
  amounts: {
    currency: string;
    gross: string;
    discount: string;
    net: string;
    tax: string;
    total: string;
  };
  details: Array<{
    productId?: string | number;
    productName: string;
    note?: string;
    barcode?: string;
    taxRate: string;
    quantity: number;
    unitPrice: string;
    grossPrice: string;
    discount: string;
    net: string;
    tax: string;
    total: string;
  }>;
}

export interface BizimhesapCancelInvoicePayload {
  firmId: string;
  guid: string;
}

export interface BizimhesapAddCustomerPayload {
  title: string;
  taxNo?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  address?: string;
  authorized?: string;
  currency?: string;
}

export interface BizimhesapAddProductPayload {
  title: string;
  taxRate: number;
  id: string;
  price: number;
  currency: string;
  productType: 0 | 1;
  unit: string;
  quantity?: number;
  barcode?: string;
}

/** GET /customers yanıtı — alan adları API'den geldiği gibi esnek tutuldu. */
export type BizimhesapCustomerRecord = Record<string, unknown>;

/** GET /products yanıtı — alan adları API'den geldiği gibi esnek tutuldu. */
export type BizimhesapProductRecord = Record<string, unknown>;

/** GET /warehouses yanıtı — alan adları API'den geldiği gibi esnek tutuldu. */
export type BizimhesapWarehouseRecord = Record<string, unknown>;

/** GET /inventory/{depo-id} yanıtı — alan adları API'den geldiği gibi esnek tutuldu. */
export type BizimhesapInventoryRecord = Record<string, unknown>;

/** GET /abstract/{musteri-id} yanıtı — alan adları API'den geldiği gibi esnek tutuldu. */
export type BizimhesapAbstractRecord = Record<string, unknown>;
