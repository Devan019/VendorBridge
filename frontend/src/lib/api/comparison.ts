import axios_api from "../axios_api";

export interface ComparisonData {
  rfq: any;
  vendors: any[];
  line_items: any[];
  highlights: any;
}

export const comparisonApi = {
  compareQuotations: async (rfqId: string) => {
    const res = await axios_api.get(`/rfqs/${rfqId}/compare`);
    return res.data.DATA || res.data;
  },

  selectQuotation: async (rfqId: string, payload: { quotation_id: string; approver_id: string; remarks?: string }) => {
    const res = await axios_api.post(`/rfqs/${rfqId}/compare/select`, payload);
    return res.data.DATA || res.data;
  }
};
