'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalApi } from '@/lib/api/approval';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ApprovalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  // 1. Fetch pending approvals (globally for demo, ideally filter by user.id)
  const { data: pendingApprovalsData, isLoading: isPendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalApi.listApprovals({ status: 'PENDING' })
  });
  
  const pendingApproval = pendingApprovalsData?.data?.[0];
  const quotationId = pendingApproval?.quotation_id;

  // 2. Fetch full timeline for the quotation
  const { data: timelineData, isLoading: isTimelineLoading } = useQuery({
    queryKey: ['approvalTimeline', quotationId],
    queryFn: () => approvalApi.getTimeline(quotationId!),
    enabled: !!quotationId
  });

  const timeline = timelineData?.timeline || [];
  const quotation = timelineData?.quotation;
  const currentApproval = pendingApproval; // The specific approval task we are viewing

  // Mutations
  const approveMutation = useMutation({
    mutationFn: () => approvalApi.approveApproval(currentApproval.id, { remarks }),
    onSuccess: () => {
      alert("Quotation Approved!");
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvalTimeline'] });
      router.push('/dashboard');
    },
    onError: (err: any) => {
      alert(`Error: ${err?.response?.data?.message || err.message}`);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () => approvalApi.rejectApproval(currentApproval.id, { remarks }),
    onSuccess: () => {
      alert("Quotation Rejected.");
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvalTimeline'] });
      router.push('/dashboard');
    },
    onError: (err: any) => {
      alert(`Error: ${err?.response?.data?.message || err.message}`);
    }
  });

  if (isPendingLoading) return <div className="p-10 text-center">Loading pending approvals...</div>;
  if (!pendingApproval || !timelineData) return <div className="p-10 text-center">No pending approvals require your attention! 🎉</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Approval Workflow</h1>
        <p className="text-lg text-muted-foreground mt-1">
          RFQ: {quotation?.rfq?.title} - Vendor: {quotation?.vendor?.name}
        </p>
      </div>

      {/* Stepper Section */}
      <div className="py-6 overflow-hidden">
        <div className="flex items-center justify-between relative max-w-3xl mx-auto">
          {/* Connecting Line */}
          <div className="absolute left-0 top-5 w-full h-[2px] bg-border -z-10"></div>
          
          <div className="flex flex-col items-center gap-2 bg-background z-10 px-2">
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-card flex items-center justify-center font-medium text-primary">
              1
            </div>
            <span className="text-xs font-medium text-muted-foreground">Submitted</span>
          </div>

          <div className="flex flex-col items-center gap-2 bg-background z-10 px-2">
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-card flex items-center justify-center font-medium text-primary">
              2
            </div>
            <span className="text-xs font-medium text-muted-foreground">L1 Review</span>
          </div>

          <div className="flex flex-col items-center gap-2 bg-background z-10 px-2">
            <div className="w-10 h-10 rounded-full border-2 border-[#eab308] bg-[#fef08a] flex items-center justify-center font-bold text-[#854d0e] shadow-sm">
              3
            </div>
            <span className="text-xs font-bold text-blue-500">L2 approval</span>
          </div>

          <div className="flex flex-col items-center gap-2 bg-background z-10 px-2">
            <div className="w-10 h-10 rounded-full border-2 border-muted-foreground bg-card flex items-center justify-center font-medium text-muted-foreground">
              4
            </div>
            <span className="text-xs font-medium text-muted-foreground">Generate PO</span>
          </div>
        </div>
      </div>

      {/* Content Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
        
        {/* Left Column: Approval Chain */}
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">Approval Chain</h3>
            <div className="space-y-6">
              
              {timeline.map((step: any, index: number) => {
                const isApproved = step.status === 'APPROVED';
                const isPending = step.status === 'PENDING';
                const isRejected = step.status === 'REJECTED';

                return (
                  <div key={step.id} className="flex gap-4">
                    <div className="mt-1">
                      {isApproved && (
                        <div className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500 bg-green-50">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {isPending && (
                        <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500 bg-blue-50 animate-pulse">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      )}
                      {isRejected && (
                        <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 bg-red-50">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{step.approver?.name || 'Unknown Approver'} ({step.approver?.role || 'Reviewer'})</p>
                      <p className="text-sm text-muted-foreground">
                        {isApproved && `Approved on ${new Date(step.decided_at).toLocaleString()}`}
                        {isRejected && `Rejected on ${new Date(step.decided_at).toLocaleString()}`}
                        {isPending && `Awaiting - Assigned ${new Date(step.created_at).toLocaleDateString()}`}
                      </p>
                      {step.remarks && <p className="text-sm italic mt-1 text-muted-foreground">"{step.remarks}"</p>}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>

          <hr className="border-border" />

          {/* Remarks */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Approval Remarks</h3>
            <textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full min-h-[120px] rounded-md border border-input bg-card px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Add your comments or conditions...."
            />
          </div>
        </div>

        {/* Right Column: Quotations Summary */}
        <div className="space-y-6">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">Quotations Summary</h3>
          <Card className="shadow-sm border-border bg-card">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Vendor:</span>
                <span className="font-medium text-right">{currentApproval.quotation.vendor.name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-right">{currentApproval.quotation.status}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Submitted At:</span>
                <span className="font-medium text-right">{new Date(currentApproval.quotation.submitted_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {approveMutation.isPending ? 'Processing...' : 'Approve'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => rejectMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Processing...' : 'Reject'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
