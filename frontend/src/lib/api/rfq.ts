import axios_api from "../axios_api";

export interface RFQItem {
  id: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit: string;
}

export interface RFQ {
  id: string;
  reference_number: string;
  title: string;
  description: string;
  deadline: string;
  status: string;
  items: RFQItem[];
}

export const rfqApi = {
  listRFQs: async (params?: { status?: string }) => {
    const res = await axios_api.get('/rfqs', { params });
    return res.data.DATA || res.data;
  },

  getRFQ: async (id: string) => {
    const res = await axios_api.get(`/rfqs/${id}`);
    return res.data.DATA || res.data;
  }
};
