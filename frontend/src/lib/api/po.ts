import axios_api from "../axios_api";

export const poApi = {
  listPOs: async (params?: any) => {
    const res = await axios_api.get('/pos', { params });
    return res.data.DATA || res.data;
  },
  getPO: async (id: string) => {
    const res = await axios_api.get(`/pos/${id}`);
    return res.data.DATA || res.data;
  }
};

export const invoiceApi = {
  listInvoices: async (params?: any) => {
    const res = await axios_api.get('/invoices', { params });
    return res.data.DATA || res.data;
  },
  getInvoice: async (id: string) => {
    const res = await axios_api.get(`/invoices/${id}`);
    return res.data.DATA || res.data;
  },
  updateInvoiceStatus: async (id: string, status: string) => {
    const res = await axios_api.patch(`/invoices/${id}/status`, { status });
    return res.data.DATA || res.data;
  }
};
