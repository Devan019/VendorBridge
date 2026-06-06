'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poApi, invoiceApi } from '@/lib/api/po';

export default function POInvoicePage() {
  const queryClient = useQueryClient();

  // 1. Fetch Purchase Orders
  const { data: posData, isLoading: isPOLoading } = useQuery({
    queryKey: ['pos'],
    queryFn: () => poApi.listPOs()
  });

  const po = posData?.data?.[0];

  // 2. Fetch Invoices (if available)
  const { data: invoicesData, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.listInvoices(),
    enabled: !!po
  });

  const invoice = invoicesData?.data?.[0];

  // 3. Mark as Paid Mutation
  const markAsPaidMutation = useMutation({
    mutationFn: () => invoiceApi.updateInvoiceStatus(invoice.id, 'PAID'),
    onSuccess: () => {
      alert("Invoice marked as PAID!");
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      alert(`Error updating invoice: ${err?.response?.data?.message || err.message}`);
    }
  });

  if (isPOLoading || isInvoiceLoading) return <div className="p-10 text-center">Loading PO & Invoice...</div>;
  if (!po) return <div className="p-10 text-center">No Purchase Orders available yet!</div>;

  const taxAmount = Number(po.tax_amount);
  const halfTax = taxAmount / 2;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Purchase Order & Invoice</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {po.po_number}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-10 px-5 text-sm">Download PDF</Button>
          <Button variant="outline" className="h-10 px-5 text-sm">Print</Button>
          <Button variant="outline" className="h-10 px-5 text-sm">Email invoice</Button>
        </div>
      </div>

      {/* Address & Meta Data Card */}
      <Card className="shadow-sm border-border bg-card">
        <CardContent className="p-0">
          
          {/* Top Section: Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 gap-8">
            <div className="space-y-3 text-sm">
              <h3 className="font-medium text-muted-foreground mb-1">Bill to:</h3>
              <p className="text-foreground leading-relaxed">
                VendorBridge HQ<br />
                123 business park, ahmedabad<br />
                GSTIN: 25383438AFB
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <h3 className="font-medium text-muted-foreground mb-1">Vendor:</h3>
              <p className="text-foreground leading-relaxed uppercase">
                {po.vendor?.name}<br />
                {po.vendor?.category}<br />
                GSTIN: {po.vendor?.gst_number}
              </p>
            </div>
          </div>

          <hr className="border-border mx-6" />

          {/* Bottom Section: Dates & Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 gap-8 text-sm text-foreground">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">PO Number:</span>
                <span className="font-medium">{po.po_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">PO date:</span>
                <span className="font-medium">{new Date(po.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Invoice date:</span>
                <span className="font-medium">{invoice ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Due date:</span>
                <span className="font-medium">{invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table Card */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/30 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium text-muted-foreground border-r border-border w-2/5">Item</th>
              <th className="px-6 py-4 font-medium text-muted-foreground border-r border-border text-center">Qty</th>
              <th className="px-6 py-4 font-medium text-muted-foreground border-r border-border text-center">Unit price (₹)</th>
              <th className="px-6 py-4 font-medium text-muted-foreground text-right">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {po.items?.map((item: any) => (
              <tr key={item.id}>
                <td className="px-6 py-4 border-r border-border text-foreground">{item.product_name}</td>
                <td className="px-6 py-4 border-r border-border text-center text-foreground">{item.quantity}</td>
                <td className="px-6 py-4 border-r border-border text-center text-foreground">{Number(item.unit_price).toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-right font-medium text-foreground">{Number(item.total).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            
            {/* Subtotal Rows */}
            <tr className="bg-secondary/10">
              <td colSpan={3} className="px-6 py-3 border-r border-border text-right text-muted-foreground font-medium">Subtotal</td>
              <td className="px-6 py-3 text-right font-medium text-foreground">₹{Number(po.subtotal).toLocaleString('en-IN')}</td>
            </tr>
            <tr className="bg-secondary/10">
              <td colSpan={3} className="px-6 py-3 border-r border-border text-right text-muted-foreground font-medium">CGST ({(Number(po.gst_rate) / 2).toFixed(1)}%)</td>
              <td className="px-6 py-3 text-right font-medium text-foreground">₹{halfTax.toLocaleString('en-IN')}</td>
            </tr>
            <tr className="bg-secondary/10">
              <td colSpan={3} className="px-6 py-3 border-r border-border text-right text-muted-foreground font-medium">SGST ({(Number(po.gst_rate) / 2).toFixed(1)}%)</td>
              <td className="px-6 py-3 text-right font-medium text-foreground">₹{halfTax.toLocaleString('en-IN')}</td>
            </tr>
            <tr className="bg-secondary/20">
              <td colSpan={3} className="px-6 py-4 border-r border-border text-right font-semibold text-foreground">Grand total</td>
              <td className="px-6 py-4 text-right font-bold text-lg text-foreground">₹{Number(po.grand_total).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer / Status Area */}
      {invoice && (
        <div className="flex items-center gap-6 pt-2 pb-8">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <span className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide ${invoice.status === 'PAID' ? 'bg-[#5dd570] text-[#0f451a]' : 'bg-[#fef08a] text-[#854d0e]'}`}>
              {invoice.status}
            </span>
          </div>
          {invoice.status !== 'PAID' && (
            <button 
              className="text-sm font-medium text-blue-500 hover:text-blue-600 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => markAsPaidMutation.mutate()}
              disabled={markAsPaidMutation.isPending}
            >
              {markAsPaidMutation.isPending ? 'Marking...' : 'Mark as Paid'}
            </button>
          )}
        </div>
      )}

    </div>
  );
}
