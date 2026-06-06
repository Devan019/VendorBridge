import axios_api from "../axios_api";

export type RFQStatus = "DRAFT" | "SENT" | "CLOSED";

export interface RFQItem {
  id?: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
}

export interface RFQVendor {
  vendor_id: string;
  vendor?: {
    id: string;
    name: string;
    category: string;
    status: string;
  };
}

export interface RFQAttachment {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  path: string;
  created_at: string;
}

export interface RFQ {
  id: string;
  reference_number: string;
  title: string;
  description: string;
  deadline: string;
  status: RFQStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  
  items?: RFQItem[];
  vendors?: RFQVendor[];
  rfqAttachments?: RFQAttachment[];
  
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  
  _count?: {
    items: number;
    vendors: number;
    rfqAttachments: number;
    quotations: number;
  };
}

export const rfqApi = {
  listRFQs: async (params?: { search?: string; status?: string; created_by?: string; sortBy?: string; order?: 'asc'|'desc'; page?: number; limit?: number }) => {
    const res = await axios_api.get('/rfqs', { params });
    return res.data.DATA || res.data;
  },

  getRFQ: async (id: string) => {
    const res = await axios_api.get(`/rfqs/${id}`);
    return res.data.DATA || res.data;
  },

  createRFQ: async (data: {
    title: string;
    description: string;
    deadline: string;
    items: RFQItem[];
    vendor_ids: string[];
    status?: RFQStatus;
  }) => {
    const res = await axios_api.post('/rfqs', data);
    return res.data.DATA || res.data;
  },

  updateRFQ: async (id: string, data: Partial<Pick<RFQ, 'title' | 'description' | 'deadline'>>) => {
    const res = await axios_api.patch(`/rfqs/${id}`, data);
    return res.data.DATA || res.data;
  },

  updateRFQStatus: async (id: string, status: RFQStatus) => {
    const res = await axios_api.patch(`/rfqs/${id}/status`, { status });
    return res.data.DATA || res.data;
  },

  deleteRFQ: async (id: string) => {
    const res = await axios_api.delete(`/rfqs/${id}`);
    return res.data.DATA || res.data;
  },

  uploadAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios_api.post(`/rfqs/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data.DATA || res.data;
  },

  deleteAttachment: async (id: string, attachmentId: string) => {
    const res = await axios_api.delete(`/rfqs/${id}/attachments/${attachmentId}`);
    return res.data.DATA || res.data;
  }
};
