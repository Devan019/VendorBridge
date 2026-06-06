import axios_api from "../axios_api";

export const approvalApi = {
  listApprovals: async (params?: { quotation_id?: string; approver_id?: string; status?: string; level?: number }) => {
    const res = await axios_api.get('/approvals', { params });
    return res.data.DATA || res.data;
  },

  createApproval: async (payload: { quotation_id: string; approver_id: string; level?: number }) => {
    const res = await axios_api.post('/approvals', payload);
    return res.data.DATA || res.data;
  },

  approveApproval: async (id: string, payload: { remarks?: string }) => {
    const res = await axios_api.patch(`/approvals/${id}/approve`, payload);
    return res.data.DATA || res.data;
  },

  rejectApproval: async (id: string, payload: { remarks?: string }) => {
    const res = await axios_api.patch(`/approvals/${id}/reject`, payload);
    return res.data.DATA || res.data;
  },

  getTimeline: async (quotationId: string) => {
    const res = await axios_api.get(`/approvals/quotation/${quotationId}`);
    return res.data.DATA || res.data;
  }
};
