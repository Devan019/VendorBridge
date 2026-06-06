'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rfqApi, RFQ } from '@/lib/api/rfq';
import { quotationApi } from '@/lib/api/quotation';
import { vendorApi } from '@/lib/api/vendor';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function QuotationsPage() {
  const router = useRouter();
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
      const input = itemInputs[item.id] || { price: 0, days: 0 };
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

  const handleSubmit = () => {
    const activeVendor = selectedVendorId || vendors[0]?.id;
    if (!rfq || !activeVendor) {
      alert("Missing RFQ or Vendor data to submit.");
      return;
    }
    
    const payloadItems = rfq.items.map(item => {
      const input = itemInputs[item.id];
      const price = input?.price || 0;
      const days = input?.days || 7;
      return {
        rfq_item_id: item.id,
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Submit Quotation</h1>
          <p className="text-lg text-muted-foreground mt-1">
            RFQ: {rfq.title} - ref {rfq.reference_number}
          </p>
        </div>
        
        <Button variant="outline" onClick={() => router.push('/dashboard/quotations/compare')}>
          View Comparison Screen ➔
        </Button>
      </div>

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
                const input = itemInputs[item.id] || { price: 0, days: 0 };
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
                        onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
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
                        onChange={(e) => handleInputChange(item.id, 'days', e.target.value)}
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
      </div>

      <hr className="border-border" />

      {/* Bottom Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Left Col: Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground ml-1">tax / GST %</label>
            <Input 
              type="number" 
              value={taxRate} 
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="max-w-[200px]" 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground ml-1">Note / terms</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
              className="bg-primary text-primary-foreground" 
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Quotation'}
            </Button>
            <Button variant="outline">Save Draft</Button>
          </div>
        </div>

        {/* Right Col: Totals */}
        <div className="flex justify-end">
          <Card className="w-full max-w-sm shadow-sm border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">GST ({taxRate}%)</span>
                <span className="font-medium">₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-border pt-3 mt-1 flex justify-between items-center">
                <span className="font-medium text-foreground">Grand total</span>
                <span className="font-bold text-lg text-foreground">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
