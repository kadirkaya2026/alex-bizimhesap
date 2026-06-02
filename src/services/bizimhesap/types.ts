export interface BizimhesapAddInvoiceResponse {
  error: string;
  guid: string;
  url: string;
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
