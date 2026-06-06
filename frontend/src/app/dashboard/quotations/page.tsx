'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { quotationApi, Quotation } from '@/lib/api/quotation';
import { rfqApi } from '@/lib/api/rfq';
import { vendorApi } from '@/lib/api/vendor';
import { FileText, ArrowRight, GitCompare, Send, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  SUBMITTED:    { label: 'Submitted',    className: 'bg-blue-100 text-blue-700',   icon: Send },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ACCEPTED:     { label: 'Accepted',     className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  REJECTED:     { label: 'Rejected',     className: 'bg-red-100 text-red-700',     icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: 'bg-muted text-muted-foreground', icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

// ── VENDOR VIEW ────────────────────────────────────────────────────────────────
function VendorView() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', 'vendor', statusFilter],
    queryFn: () => quotationApi.listQuotations({ status: statusFilter || undefined }),
  });

  const quotations: Quotation[] = data?.data ?? [];


  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Quotations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Track your submitted quotations and their status</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">No quotations yet</h3>
          <p className="text-sm text-muted-foreground">Quotations you submit for RFQs will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotations.map(q => (
            <div
              key={q.id}
              onClick={() => router.push(`/dashboard/quotations/${q.id}`)}
              className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-2.5 rounded-lg mt-0.5">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{q.rfq?.title ?? 'RFQ'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ref: {q.rfq?.reference_number ?? q.rfq_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(q.submitted_at).toLocaleDateString()}
                    {q.total_amount ? ` · ₹${q.total_amount.toLocaleString('en-IN')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={q.status} />
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── OFFICER / MANAGER VIEW ─────────────────────────────────────────────────────
function OfficerView() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: rfqsData } = useQuery({
    queryKey: ['rfqs', 'sent'],
    queryFn: () => rfqApi.listRFQs({ status: 'SENT' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', 'all', statusFilter],
    queryFn: () => quotationApi.listQuotations({ status: statusFilter || undefined }),
  });

  const quotations: Quotation[] = data?.data ?? [];
  const rfqs = rfqsData?.data ?? [];

  // Group quotations by RFQ
  const grouped = quotations.reduce<Record<string, { rfq: any; quotes: Quotation[] }>>((acc, q) => {
    const key = q.rfq_id;
    if (!acc[key]) {
      acc[key] = { rfq: q.rfq, quotes: [] };
    }
    acc[key].quotes.push(q);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">All Quotations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Review vendor quotations grouped by RFQ. Use Compare to evaluate and finalize.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-foreground mb-1">No quotations received</h3>
          <p className="text-sm text-muted-foreground">Vendor submissions will appear here grouped by RFQ.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([rfqId, { rfq, quotes }]) => (
            <div key={rfqId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* RFQ Header */}
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{rfq?.title ?? rfqId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ref: {rfq?.reference_number ?? rfqId} · {quotes.length} quotation{quotes.length !== 1 ? 's' : ''} received
                  </p>
                </div>
                {quotes.length > 1 && (
                  <button
                    onClick={() => router.push(`/dashboard/rfqs/${rfqId}/compare`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <GitCompare className="w-4 h-4" />
                    Compare ({quotes.length})
                  </button>
                )}
              </div>

              {/* Quotation Rows */}
              <div className="divide-y">
                {quotes.map(q => (
                  <div
                    key={q.id}
                    onClick={() => router.push(`/dashboard/quotations/${q.id}`)}
                    className="px-5 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                        {q.vendor?.name?.charAt(0) ?? 'V'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{q.vendor?.name ?? 'Unknown Vendor'}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.vendor?.category} · Submitted {new Date(q.submitted_at).toLocaleDateString()}
                          {q.total_amount ? ` · ₹${q.total_amount.toLocaleString('en-IN')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={q.status} />
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ROOT: pick view based on role ──────────────────────────────────────────────
export default function QuotationsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'VENDOR' ? <VendorView /> : <OfficerView />;
}
