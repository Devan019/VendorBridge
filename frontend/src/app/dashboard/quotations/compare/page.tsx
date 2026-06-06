'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rfqApi } from '@/lib/api/rfq';
import { comparisonApi, ComparisonData } from '@/lib/api/comparison';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { approvalApi } from '@/lib/api/approval';

export default function QuotationComparisonPage() {
  const router = useRouter();
  const { user } = useAuth();

  // 1. Fetch active RFQs to get the first one for comparison
  const { data: rfqs, isLoading: isRfqLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => rfqApi.listRFQs({ status: 'SENT' })
  });
  
  const rfqId = rfqs?.data?.[0]?.id;

  // 2. Fetch Comparison Matrix Data
  const { data: comparisonWrapper, isLoading: isComparisonLoading } = useQuery({
    queryKey: ['comparison', rfqId],
    queryFn: () => comparisonApi.compareQuotations(rfqId!),
    enabled: !!rfqId
  });

  const comparison: ComparisonData | undefined = comparisonWrapper?.data;

  // 3. Mutation to Select and initiate approval
  const selectMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      if (!user?.id) throw new Error("No user logged in");
      
      // Hit the select API to accept this quote over the others
      await comparisonApi.selectQuotation(rfqId!, { 
        quotation_id: quotationId, 
        approver_id: user.id, // Current user selecting
        remarks: "Selected via comparison matrix"
      });

      // Also create an approval request for L2 Review
      // Assuming a generic approver for demo (or the same user if they are L2)
      await approvalApi.createApproval({
        quotation_id: quotationId,
        approver_id: user.id, // Routing to self for demo purposes
        level: 1
      });
    },
    onSuccess: () => {
      alert("Quotation selected! Approval workflow initiated.");
      router.push('/dashboard/approvals');
    },
    onError: (err: any) => {
      alert(`Error selecting quotation: ${err?.response?.data?.message || err.message}`);
    }
  });

  if (isRfqLoading || isComparisonLoading) return <div className="p-10 text-center">Loading comparison data...</div>;
  if (!rfqId || !comparison || comparison.vendors.length === 0) return <div className="p-10 text-center">No quotations available for comparison. Go submit some first!</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-auto">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Quotation Comparison</h1>
        <p className="text-lg text-muted-foreground mt-1">
          RFQ: {comparison.rfq.title} - {comparison.rfq.total_quotations} quotations received
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="pt-4 overflow-x-auto pb-4">
        <div className="flex flex-nowrap rounded-xl border border-border bg-card overflow-hidden shadow-sm text-sm w-max min-w-full">
          
          {/* Criteria Column */}
          <div className="w-48 flex-shrink-0 flex flex-col border-r border-border bg-secondary/30 text-muted-foreground sticky left-0 z-20">
            <div className="h-16 flex items-center px-5 font-medium border-b border-border bg-secondary/50">Criteria</div>
            <div className="h-14 flex items-center px-5 border-b border-border bg-secondary/30">Grand Total</div>
            <div className="h-14 flex items-center px-5 border-b border-border bg-secondary/30">Max Delivery (days)</div>
            <div className="h-14 flex items-center px-5 border-b border-border bg-secondary/30">Avg Unit Price</div>
            <div className="h-14 flex items-center px-5 border-b border-border bg-secondary/30">Items Quoted</div>
            <div className="h-20 flex items-center px-5 bg-secondary/30"></div>
          </div>

          {/* Map through Vendors */}
          {comparison.vendors.map((vendor: any) => {
            const isLowest = vendor.quotation_id === comparison.highlights?.lowest_total_price?.quotation_id;
            
            return (
              <div 
                key={vendor.quotation_id} 
                className={`w-64 flex-shrink-0 flex flex-col transition-all ${
                  isLowest 
                    ? 'bg-[#5dd570] text-[#0f451a] border-x-2 border-[#18792b] relative z-10 shadow-lg transform scale-[1.02] rounded-md'
                    : 'border-r border-border hover:bg-secondary/10'
                }`}
              >
                <div className={`h-16 flex items-center justify-center text-center px-2 border-b ${isLowest ? 'font-bold border-[#3ba14a]' : 'font-medium border-border'}`}>
                  {vendor.vendor_name} {isLowest && '(Lowest)'}
                </div>
                <div className={`h-14 flex items-center justify-center border-b ${isLowest ? 'border-[#3ba14a]' : 'border-border'}`}>
                  ₹{vendor.total_price.toLocaleString('en-IN')}
                </div>
                <div className={`h-14 flex items-center justify-center border-b ${isLowest ? 'border-[#3ba14a]' : 'border-border'}`}>
                  {vendor.max_delivery_days} days
                </div>
                <div className={`h-14 flex items-center justify-center border-b ${isLowest ? 'border-[#3ba14a]' : 'border-border'}`}>
                  ₹{vendor.avg_unit_price.toLocaleString('en-IN')}
                </div>
                <div className={`h-14 flex items-center justify-center border-b ${isLowest ? 'border-[#3ba14a]' : 'border-border'}`}>
                  {vendor.items_count} / {comparison.rfq.total_items}
                </div>
                <div className="h-20 flex items-center justify-center px-4">
                  <Button 
                    variant={isLowest ? 'default' : 'outline'}
                    className={`w-full ${isLowest ? 'bg-[#18792b] hover:bg-[#115a1e] text-white shadow-sm border border-[#0f451a]/50' : 'border-input bg-transparent hover:bg-secondary/50'}`}
                    onClick={() => selectMutation.mutate(vendor.quotation_id)}
                    disabled={selectMutation.isPending}
                  >
                    {selectMutation.isPending ? 'Processing...' : (isLowest ? 'Select & Approve' : 'Select')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Helper Text */}
        <p className="mt-4 text-sm font-medium text-[#e14e4e]">
          Green = lowest price, selecting vendor initiates the approval workflow.
        </p>
      </div>

    </div>
  );
}
