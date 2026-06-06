'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { rfqApi, RFQStatus, RFQVendor, RFQItem, RFQAttachment } from '@/lib/api/rfq';
import { FrontendRoutes } from '@/constants/frontend_route';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Download, Trash2, Edit, ChevronLeft, Package, User } from 'lucide-react';

export default function RFQDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: rfqResponse, isLoading, refetch } = useQuery({
    queryKey: ['rfq', id],
    queryFn: () => rfqApi.getRFQ(id)
  });

  const rfq = rfqResponse?.data;
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading RFQ details...</div>;
  }

  if (!rfq) {
    return <div className="p-12 text-center text-destructive">RFQ not found.</div>;
  }

  const handleStatusChange = async (newStatus: RFQStatus) => {
    setIsUpdatingStatus(true);
    try {
      await rfqApi.updateRFQStatus(id, newStatus);
      refetch();
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this RFQ?')) return;
    setIsDeleting(true);
    try {
      await rfqApi.deleteRFQ(id);
      router.push(FrontendRoutes.RFQS);
    } catch (err) {
      console.error('Failed to delete RFQ', err);
      alert('Failed to delete RFQ');
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'SENT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CLOSED': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <Link href={FrontendRoutes.RFQS} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to RFQs
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-2 h-full ${
          rfq.status === 'SENT' ? 'bg-blue-500' :
          rfq.status === 'CLOSED' ? 'bg-green-500' : 'bg-gray-300'
        }`} />

        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="pl-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2.5 py-1 rounded-md border">
                {rfq.reference_number}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${getStatusBadge(rfq.status)}`}>
                {rfq.status}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">{rfq.title}</h1>
            <p className="text-muted-foreground max-w-3xl whitespace-pre-wrap">{rfq.description}</p>
            
            <div className="flex flex-wrap gap-6 mt-6">
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground mr-1">Created:</span>
                <span className="font-medium">{new Date(rfq.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground mr-1">Deadline:</span>
                <span className="font-medium text-destructive">{new Date(rfq.deadline).toLocaleString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground mr-1">Creator:</span>
                <span className="font-medium">{rfq.creator?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            {rfq.status === 'DRAFT' && (
              <>
                <Button 
                  onClick={() => handleStatusChange('SENT')} 
                  isLoading={isUpdatingStatus}
                  className="w-full md:w-auto"
                >
                  Publish & Send RFQ
                </Button>
                <Button 
                  variant="outline" 
                  className="text-destructive hover:bg-destructive/10 border-destructive/20 w-full md:w-auto"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete RFQ
                </Button>
              </>
            )}
            {rfq.status === 'SENT' && (
              <Button 
                variant="outline" 
                onClick={() => handleStatusChange('CLOSED')} 
                isLoading={isUpdatingStatus}
                className="w-full md:w-auto border-green-500 text-green-700 hover:bg-green-50"
              >
                Close RFQ
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Line Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center mb-6 border-b pb-2">
              <Package className="w-5 h-5 mr-2 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Line Items</h2>
              <span className="ml-auto bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                {rfq.items?.length || 0}
              </span>
            </div>

            <div className="space-y-4">
              {rfq.items && rfq.items.length > 0 ? (
                rfq.items.map((item: RFQItem, index: number) => (
                  <div key={item.id || index} className="p-4 border rounded-lg bg-secondary/5 flex justify-between items-start hover:border-primary/30 transition-colors">
                    <div>
                      <h4 className="font-semibold text-foreground">{item.product_name}</h4>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">
                        {item.quantity} <span className="text-sm font-medium text-muted-foreground">{item.unit}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No line items attached.</p>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center mb-6 border-b pb-2">
              <FileText className="w-5 h-5 mr-2 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Attachments</h2>
              <span className="ml-auto bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                {rfq.rfqAttachments?.length || 0}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rfq.rfqAttachments && rfq.rfqAttachments.length > 0 ? (
                rfq.rfqAttachments.map((file: RFQAttachment) => (
                  <div key={file.id} className="flex items-center p-3 border rounded-lg bg-secondary/10 group">
                    <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center mr-3 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-sm font-medium truncate text-foreground">{file.original_name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size_bytes / 1024).toFixed(1)} KB</p>
                    </div>
                    <a 
                      href={file.path} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-primary bg-white rounded-md border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic col-span-2">No attachments provided.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Vendors */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center mb-6 border-b pb-2">
              <h2 className="text-xl font-semibold">Assigned Vendors</h2>
              <span className="ml-auto bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-0.5 rounded-full">
                {rfq.vendors?.length || 0}
              </span>
            </div>

            <div className="space-y-3">
              {rfq.vendors && rfq.vendors.length > 0 ? (
                rfq.vendors.map((v: RFQVendor) => (
                  <Link key={v.vendor_id} href={`${FrontendRoutes.VENDORS}/${v.vendor_id}`}>
                    <div className="p-3 border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer group">
                      <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {v.vendor?.name || 'Unknown Vendor'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.vendor?.category}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-4 bg-secondary/20 rounded-lg border border-dashed text-center">
                  <p className="text-sm text-muted-foreground">This RFQ has not been assigned to any vendors yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
