'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { quotationApi } from '@/lib/api/quotation';
import { FormError } from '@/components/ui/FormError';
import { ArrowLeft, GitCompare, Send, Package, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  SUBMITTED:    { label: 'Submitted',    className: 'bg-blue-100 text-blue-700',    icon: Send },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ACCEPTED:     { label: 'Accepted',     className: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  REJECTED:     { label: 'Rejected',     className: 'bg-red-100 text-red-700',      icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: 'bg-muted text-muted-foreground', icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${s.className}`}>
      <Icon className="w-4 h-4" />
      {s.label}
    </span>
  );
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getQuotation(id),
    enabled: !!id,
  });

  const quotation = data?.data ?? data;

  // VENDOR: submit action
  const submitMutation = useMutation({
    mutationFn: () => quotationApi.submitQuotation(id),
    onSuccess: () => {
      toast.success('Quotation submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.ERROR || 'Failed to submit quotation.');
    },
  });

  // OFFICER/MANAGER: status update
  const statusMutation = useMutation({
    mutationFn: (status: string) => quotationApi.updateStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(`Quotation marked as ${status.replace('_', ' ').toLowerCase()}.`);
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.ERROR || 'Failed to update status.');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-6 animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-60 bg-muted rounded-xl" />
      </div>
    );
  }

  if (isError || !quotation) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-10 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Quotation not found</h2>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    );
  }

  const isVendor = user?.role === 'VENDOR';
  const isOfficerOrManager = user?.role === 'PROCUREMENT_OFFICER' || user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const items = quotation.items ?? [];
  const subtotal = items.reduce((sum: number, item: any) => {
    const qty = item.rfqItem?.quantity ?? 1;
    return sum + (item.unit_price ?? 0) * qty;
  }, 0);
  const gstRate = 18;
  const gstAmount = (subtotal * gstRate) / 100;
  const grandTotal = subtotal + gstAmount;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-20 space-y-6">
      {/* Back + Title */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quotations
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Quotation Details</h1>
          <p className="text-muted-foreground text-sm mt-1">
            RFQ: <span className="font-medium text-foreground">{quotation.rfq?.title ?? quotation.rfq_id}</span>
            {quotation.rfq?.reference_number && (
              <span className="ml-2 text-xs">· Ref: {quotation.rfq.reference_number}</span>
            )}
          </p>
        </div>
        <StatusBadge status={quotation.status} />
      </div>

      <FormError error={error} />

      {/* Vendor + RFQ Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Vendor</p>
          <p className="font-semibold text-foreground">{quotation.vendor?.name ?? 'N/A'}</p>
          <p className="text-sm text-muted-foreground">{quotation.vendor?.category}</p>
          {quotation.vendor?.gst_number && (
            <p className="text-xs text-muted-foreground mt-1">GST: {quotation.vendor.gst_number}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Timeline</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Submitted: </span>
            <span className="font-medium">{new Date(quotation.submitted_at).toLocaleString()}</span>
          </p>
          {quotation.rfq?.deadline && (
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">RFQ Deadline: </span>
              <span className="font-medium">{new Date(quotation.rfq.deadline).toLocaleDateString()}</span>
            </p>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Line Items &amp; Pricing</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No items found for this quotation.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Unit Price (₹)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total (₹)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item: any, idx: number) => {
                const qty = item.rfqItem?.quantity ?? 1;
                const lineTotal = (item.unit_price ?? 0) * qty;
                return (
                  <tr key={item.id ?? idx} className="hover:bg-muted/10">
                    <td className="px-5 py-3">
                      <p className="font-medium">{item.rfqItem?.product_name ?? `Item ${idx + 1}`}</p>
                      {item.rfqItem?.description && (
                        <p className="text-xs text-muted-foreground">{item.rfqItem.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {qty} {item.rfqItem?.unit ?? ''}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{(item.unit_price ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{lineTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {item.delivery_days ? `${item.delivery_days} days` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="border-t px-5 py-4 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (18%)</span>
              <span className="font-medium">₹{gstAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-foreground">Grand Total</span>
              <span className="font-bold text-lg text-foreground">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Notes &amp; Terms</h2>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
        </div>
      )}

      {/* ── ACTION AREA ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">

        {/* VENDOR: can only submit (re-confirm) */}
        {isVendor && quotation.status === 'SUBMITTED' && (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? 'Submitting...' : 'Re-confirm Submission'}
          </button>
        )}

        {/* OFFICER/MANAGER: no submission, only status management + Compare */}
        {isOfficerOrManager && (
          <>
            {quotation.status === 'SUBMITTED' && (
              <button
                onClick={() => statusMutation.mutate('UNDER_REVIEW')}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-60"
              >
                <Clock className="w-4 h-4" />
                Mark Under Review
              </button>
            )}
            {quotation.status === 'UNDER_REVIEW' && (
              <>
                <button
                  onClick={() => statusMutation.mutate('REJECTED')}
                  disabled={statusMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-destructive text-destructive rounded-lg text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-60"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => statusMutation.mutate('ACCEPTED')}
                  disabled={statusMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept
                </button>
              </>
            )}
            {quotation.rfq_id && (
              <button
                onClick={() => router.push(`/dashboard/rfqs/${quotation.rfq_id}/compare`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <GitCompare className="w-4 h-4" />
                Compare All Quotations
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
