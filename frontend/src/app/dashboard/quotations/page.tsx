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
  const { user } = useAuth();
  
  const [taxRate, setTaxRate] = useState<number>(18);
  const [notes, setNotes] = useState<string>('Payment terms: 20 days net...');
  
  // State for items: { [rfq_item_id]: { price, days } }
  const [itemInputs, setItemInputs] = useState<Record<string, { price: number; days: number }>>({});

  // 1. Fetch active RFQs (for demo, just grab the first SENT one)
  const { data: rfqs, isLoading: isRfqListLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => rfqApi.listRFQs({ status: 'SENT' })
  });
  
  const firstRfqId = rfqs?.data?.[0]?.id;

  // 1.b Fetch the full RFQ details to get the items
  const { data: fullRfqData, isLoading: isRfqDetailLoading } = useQuery({
    queryKey: ['rfq', firstRfqId],
    queryFn: () => rfqApi.getRFQ(firstRfqId!),
    enabled: !!firstRfqId
  });

  const rfq: RFQ | undefined = fullRfqData?.data;

  // 2. Fetch vendors to allow selection
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.listVendors()
  });
  const vendors = vendorsData?.data || [];
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // 3. Mutation to submit the quotation
  const submitMutation = useMutation({
    mutationFn: quotationApi.createQuotation,
    onSuccess: () => {
      alert("Quotation submitted successfully!");
      router.push('/dashboard/quotations/compare');
    },
    onError: (err: any) => {
      alert(`Error submitting quotation: ${err?.response?.data?.message || err.message}`);
    }
  });

  // Calculate totals dynamically
  const subtotal = useMemo(() => {
    if (!rfq?.items) return 0;
    return rfq.items.reduce((sum, item) => {
      const input = itemInputs[item.id as string] || { price: 0, days: 0 };
      return sum + (input.price * item.quantity);
    }, 0);
  }, [rfq, itemInputs]);

  const gstAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + gstAmount;

  const handleInputChange = (itemId: string, field: 'price' | 'days', value: string) => {
    const num = parseFloat(value) || 0;
    setItemInputs(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId] ?? { price: 0, days: 0 },
        [field]: num
      }
    }));
  };

  const quotations: Quotation[] = data?.data ?? [];

  const handleSubmit = () => {
    const activeVendor = selectedVendorId || vendors[0]?.id;
    if (!rfq || !activeVendor || !rfq.items) {
      alert("Missing RFQ, items, or Vendor data to submit.");
      return;
    }
    
    const payloadItems = rfq.items.map(item => {
      const input = itemInputs[item.id as string];
      const price = input?.price || 0;
      const days = input?.days || 7;
      return {
        rfq_item_id: item.id as string,
        unit_price: Math.max(0, price),
        delivery_days: days < 1 ? 7 : days,
        notes: ""
      };
    });

    submitMutation.mutate({
      rfq_id: rfq.id,
      vendor_id: activeVendor,
      notes: notes,
      items: payloadItems
    });
  };

  const isRfqLoading = isRfqListLoading || isRfqDetailLoading;
  if (isRfqLoading) return <div className="p-10 text-center">Loading RFQ data...</div>;
  if (!rfq || !rfq.items) return <div className="p-10 text-center">No active SENT RFQs found to quote on.</div>;

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
      {/* RFQ Summary Card & Vendor Selection */}
      <Card className="shadow-sm border-border bg-card">
        <CardContent className="p-4 flex flex-col justify-center space-y-4">
          <div>
            <span className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">RFQ Summary</span>
            <p className="text-foreground">
              {rfq.description} - Deadline: {new Date(rfq.deadline).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Select Vendor (For Demo)</span>
            <select 
              className="mt-1 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name} (GST: {v.gst_number})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Pick a vendor that hasn't quoted yet to avoid 409 Conflict.</p>
          </div>
        </CardContent>
      </Card>

      {/* Quotation Table Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground ml-1">Your Quotation</h2>
        
        <div className="rounded-md border border-border overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium text-foreground w-1/3 border-r border-border">Item</th>
                <th className="px-4 py-3 font-medium text-foreground border-r border-border text-center">Qty</th>
                <th className="px-4 py-3 font-medium text-foreground border-r border-border text-right">Unit price (₹)</th>
                <th className="px-4 py-3 font-medium text-foreground border-r border-border text-right">Total</th>
                <th className="px-4 py-3 font-medium text-foreground text-center">Delivery (days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rfq.items.map(item => {
                const input = itemInputs[item.id as string] || { price: 0, days: 0 };
                const itemTotal = item.quantity * input.price;
                return (
                  <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 border-r border-border">{item.product_name} <span className="text-muted-foreground text-xs block">{item.description}</span></td>
                    <td className="px-4 py-3 border-r border-border text-center">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-2 border-r border-border">
                      <Input 
                        type="number"
                        min="0"
                        value={input.price || ''}
                        onChange={(e) => handleInputChange(item.id as string, 'price', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-right bg-transparent border-transparent hover:border-input focus:border-input" 
                      />
                    </td>
                    <td className="px-4 py-3 border-r border-border text-right font-medium">
                      {itemTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2">
                      <Input 
                        type="number"
                        min="1"
                        value={input.days || ''}
                        onChange={(e) => handleInputChange(item.id as string, 'days', e.target.value)}
                        placeholder="Days"
                        className="h-8 text-center bg-transparent border-transparent hover:border-input focus:border-input" 
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
