import axios_api from "../axios_api";

export type VendorStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";

export interface Vendor {
  id: string;
  name: string;
  category: string;
  gst_number: string;
  contact_email: string;
  phone?: string;
  address?: string;
  tags: string[];
  status: VendorStatus;
  created_at: string;
  updated_at: string;
}

export interface VendorNote {
  id: string;
  vendor_id: string;
  author_id?: string;
  content: string;
  created_at: string;
  author?: {
    id: string;
    name: string;
    email: string;
  }
}

export const vendorApi = {
  listVendors: async (params?: { search?: string; status?: string; category?: string; sort?: string; order?: 'asc'|'desc'; page?: number; limit?: number }) => {
    const res = await axios_api.get('/vendors', { params });
    return res.data.DATA || res.data; // Handle the uppercase wrapper format if it applies
  },

  getVendor: async (id: string) => {
    const res = await axios_api.get(`/vendors/${id}`);
    return res.data.DATA || res.data;
  },

  createVendor: async (data: Partial<Vendor>) => {
    const res = await axios_api.post('/vendors', data);
    return res.data.DATA || res.data;
  },

  updateVendor: async (id: string, data: Partial<Vendor>) => {
    const res = await axios_api.patch(`/vendors/${id}`, data);
    return res.data.DATA || res.data;
  },

  deleteVendor: async (id: string, hard: boolean = false) => {
    const res = await axios_api.delete(`/vendors/${id}`, { params: { hard } });
    return res.data.DATA || res.data;
  },

  listCategories: async () => {
    const res = await axios_api.get('/vendors/categories');
    return res.data.DATA || res.data;
  },

  getVendorHistory: async (id: string) => {
    const res = await axios_api.get(`/vendors/${id}/history`);
    return res.data.DATA || res.data;
  },

  addVendorNote: async (id: string, note: string) => {
    const res = await axios_api.post(`/vendors/${id}/notes`, { content: note });
    return res.data.DATA || res.data;
  }
};
