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

export interface QuotationItem {
  id: string;
  rfq_item_id: string;
  unit_price: number;
  delivery_days: number;
  notes?: string;
  rfqItem?: {
    product_name: string;
    quantity: number;
    unit: string;
    description?: string;
  };
}

export interface Quotation {
  id: string;
  rfq_id: string;
  vendor_id: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  notes?: string;
  total_amount?: number;
  submitted_at: string;
  updated_at: string;
  vendor?: { id: string; name: string; category: string; gst_number?: string };
  rfq?: { id: string; reference_number: string; title: string; deadline: string; status: string };
  items?: QuotationItem[];
  _count?: { items: number };
}

export const quotationApi = {
  createQuotation: async (payload: CreateQuotationPayload) => {
    const res = await axios_api.post('/quotations', payload);
    return res.data.DATA || res.data;
  },

  listQuotations: async (params?: { rfq_id?: string; vendor_id?: string; status?: string; page?: number; limit?: number }) => {
    const res = await axios_api.get('/quotations', { params });
    return res.data.DATA || res.data;
  },

  getQuotation: async (id: string) => {
    const res = await axios_api.get(`/quotations/${id}`);
    return res.data.DATA || res.data;
  },

  submitQuotation: async (id: string) => {
    const res = await axios_api.post(`/quotations/${id}/submit`);
    return res.data.DATA || res.data;
  },

  updateStatus: async (id: string, status: string) => {
    const res = await axios_api.patch(`/quotations/${id}/status`, { status });
    return res.data.DATA || res.data;
  },

  listRFQQuotations: async (rfqId: string) => {
    const res = await axios_api.get(`/rfqs/${rfqId}/quotations`);
    return res.data.DATA || res.data;
  },
};
