import axios_api from "../axios_api";

export interface QuotationItemPayload {
  rfq_item_id: string;
  unit_price: number;
  delivery_days: number;
  notes?: string;
}

export interface CreateQuotationPayload {
  rfq_id: string;
  vendor_id: string;
  notes?: string;
  items: QuotationItemPayload[];
}

export const quotationApi = {
  createQuotation: async (payload: CreateQuotationPayload) => {
    const res = await axios_api.post('/quotations', payload);
    return res.data.DATA || res.data;
  },

  listQuotations: async (params?: { rfq_id?: string; vendor_id?: string; status?: string }) => {
    const res = await axios_api.get('/quotations', { params });
    return res.data.DATA || res.data;
  },

  getQuotation: async (id: string) => {
    const res = await axios_api.get(`/quotations/${id}`);
    return res.data.DATA || res.data;
  }
};
