import axios_api from "../axios_api";

export const analyticsApi = {
  getProcurementStats: async (params?: any) => {
    const res = await axios_api.get('/analytics/procurement', { params });
    return res.data.DATA || res.data;
  },
  getSpendingSummaries: async (params?: any) => {
    const res = await axios_api.get('/analytics/spending', { params });
    return res.data.DATA || res.data;
  },
  getVendorPerformance: async (params?: any) => {
    const res = await axios_api.get('/analytics/vendors', { params });
    return res.data.DATA || res.data;
  },
  getMonthlyTrends: async (params?: any) => {
    const res = await axios_api.get('/analytics/trends', { params });
    return res.data.DATA || res.data;
  }
};
