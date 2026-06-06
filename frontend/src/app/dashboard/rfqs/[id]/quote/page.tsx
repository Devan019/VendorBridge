'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rfqApi, RFQItem } from '@/lib/api/rfq';
import { quotationApi, CreateQuotationPayload } from '@/lib/api/quotation';
import { vendorApi } from '@/lib/api/vendor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { ChevronLeft, Send, Package } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SubmitQuotationPage() {
  const { id: rfqId } = useParams() as { id: string };
  const router = useRouter();

  const [notes, setNotes] = useState('');
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({});
  const [itemDelivery, setItemDelivery] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: rfqData, isLoading: isLoadingRFQ } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => rfqApi.getRFQ(rfqId),
  });

  const { data: vendorData, isLoading: isLoadingVendor } = useQuery({
    queryKey: ['vendor', 'me'],
    queryFn: () => vendorApi.getMyVendor(),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: CreateQuotationPayload) => quotationApi.createQuotation(payload),
    onSuccess: () => {
      toast.success('Quotation submitted successfully!');
      router.push('/dashboard/quotations');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.ERROR || 'Failed to submit quotation.');
    },
  });

  if (isLoadingRFQ || isLoadingVendor) {
    return <div className="p-12 text-center animate-pulse">Loading...</div>;
  }

  const rfq = rfqData?.data;
  const vendor = vendorData?.data;

  if (!rfq) return <div className="p-12 text-center text-destructive">RFQ not found.</div>;
  if (!vendor) return <div className="p-12 text-center text-destructive">Vendor profile not found. Contact administrator.</div>;

  const handlePriceChange = (itemId: string, value: string) => {
    setItemPrices(prev => ({ ...prev, [itemId]: parseFloat(value) || 0 }));
  };

  const handleDeliveryChange = (itemId: string, value: string) => {
    setItemDelivery(prev => ({ ...prev, [itemId]: parseInt(value) || 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const items = rfq.items?.map((item: RFQItem) => {
      const price = itemPrices[item.id!] || 0;
      const delivery = itemDelivery[item.id!] || 0;
      return {
        rfq_item_id: item.id!,
        unit_price: price,
        delivery_days: delivery,
      };
    }) || [];

    if (items.some((i: any) => i.unit_price <= 0)) {
      setError('Please provide a valid unit price for all items.');
      return;
    }

    if (items.some((i: any) => i.delivery_days <= 0)) {
      setError('Please provide valid delivery days for all items.');
      return;
    }

    submitMutation.mutate({
      rfq_id: rfqId,
      vendor_id: vendor.id,
      notes,
      items,
    });
  };

  const subtotal = rfq.items?.reduce((sum: number, item: RFQItem) => {
    return sum + (itemPrices[item.id!] || 0) * item.quantity;
  }, 0) || 0;

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-6 px-4">
      <Link href={`/dashboard/rfqs/${rfqId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to RFQ
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Submit Quotation</h1>
        <p className="text-muted-foreground mt-1 text-sm">For RFQ: <span className="font-medium text-foreground">{rfq.title}</span></p>
      </div>

      <FormError error={error} className="mb-6" />

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 bg-secondary/10">
            <Package className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Pricing & Delivery</h2>
          </div>
          
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-32">Unit Price (₹)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground w-32">Total (₹)</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-32">Delivery (Days)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rfq.items?.map((item: RFQItem) => {
                const price = itemPrices[item.id!] || 0;
                const total = price * item.quantity;
                return (
                  <tr key={item.id} className="hover:bg-muted/5">
                    <td className="px-5 py-3">
                      <p className="font-medium">{item.product_name}</p>
                      {item.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {item.quantity} <span className="text-xs">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className="h-8 text-right"
                        value={itemPrices[item.id!] || ''}
                        onChange={(e) => handlePriceChange(item.id!, e.target.value)}
                        disabled={submitMutation.isPending}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="1"
                        required
                        className="h-8 text-center"
                        value={itemDelivery[item.id!] || ''}
                        onChange={(e) => handleDeliveryChange(item.id!, e.target.value)}
                        disabled={submitMutation.isPending}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t px-5 py-4 bg-muted/10 flex justify-end">
            <div className="text-sm">
              <span className="text-muted-foreground mr-4">Estimated Subtotal:</span>
              <span className="font-bold text-lg text-foreground">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <label className="block text-sm font-medium mb-2 text-foreground">Additional Notes & Terms</label>
          <textarea
            className="flex min-h-[120px] w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm"
            placeholder="Include any specific terms, conditions, or notes regarding your quotation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitMutation.isPending}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitMutation.isPending} className="gap-2">
            <Send className="w-4 h-4" /> Submit Quotation
          </Button>
        </div>
      </form>
    </div>
  );
}
