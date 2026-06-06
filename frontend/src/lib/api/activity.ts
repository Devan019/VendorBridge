import axios_api from "../axios_api";

export const activityApi = {
  listActivity: async (params?: any) => {
    const res = await axios_api.get('/activity', { params });
    return res.data.DATA || res.data;
  }
};
