'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';

export default function ReportsPage() {
  const { data: procurementData, isLoading: isProcurementLoading } = useQuery({
    queryKey: ['analytics', 'procurement'],
    queryFn: () => analyticsApi.getProcurementStats()
  });

  const { data: spendingData, isLoading: isSpendingLoading } = useQuery({
    queryKey: ['analytics', 'spending'],
    queryFn: () => analyticsApi.getSpendingSummaries()
  });

  const { data: vendorData, isLoading: isVendorLoading } = useQuery({
    queryKey: ['analytics', 'vendors'],
    queryFn: () => analyticsApi.getVendorPerformance()
  });

  const { data: trendsData, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: () => analyticsApi.getMonthlyTrends()
  });

  const isLoading = isProcurementLoading || isSpendingLoading || isVendorLoading || isTrendsLoading;

  if (isLoading) return <div className="p-10 text-center">Loading Analytics...</div>;

  const procurement = procurementData?.data;
  const spending = spendingData?.data || [];
  const vendors = vendorData?.data || [];
  const trends = trendsData?.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Procurement Insights
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-10 px-5 text-sm bg-card">Current Month</Button>
          <Button variant="outline" className="h-10 px-5 text-sm bg-card">Export</Button>
        </div>
      </div>

      {/* 4 Statistic Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl font-medium text-blue-500">₹{Number(procurement?.total_spend || 0).toLocaleString('en-IN')}</span>
            <span className="text-sm font-medium text-blue-500">total spend</span>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl font-medium text-green-500">{procurement?.active_vendors || 0}</span>
            <span className="text-sm font-medium text-green-500">Active vendors</span>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl font-medium text-orange-500">
              {procurement?.po_fulfillment_rate ? `${Number(procurement.po_fulfillment_rate).toFixed(1)}%` : '0%'}
            </span>
            <span className="text-sm font-medium text-orange-500">PO Fulfillment</span>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-6 flex flex-col items-center justify-center space-y-2">
            <span className="text-3xl font-medium text-red-500">{procurement?.overdue_invoices || 0}</span>
            <span className="text-sm font-medium text-red-500">overdue invoices</span>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section: Spend By Category & Top Vendors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Spend by Category */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Spend By Category</h3>
          <Card className="shadow-sm border-border bg-card">
            <CardContent className="p-6 space-y-6">
              
              {spending.map((cat: any, i: number) => {
                const colors = ['bg-blue-600', 'bg-green-500', 'bg-orange-400', 'bg-red-500', 'bg-purple-500'];
                const color = colors[i % colors.length];
                const totalSpend = Number(procurement?.total_spend || 1);
                const percent = Math.max(5, (Number(cat._sum.grand_total) / totalSpend) * 100);

                return (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-foreground">{cat.category}</span>
                      <span className="text-foreground">₹{Number(cat._sum.grand_total).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className={`${color} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}

              {spending.length === 0 && <div className="text-sm text-muted-foreground">No category spend data available.</div>}

            </CardContent>
          </Card>
        </div>

        {/* Right: Top Vendors By Spend & Monthly Trend */}
        <div className="space-y-8">
          
          {/* Top Vendors Table */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Top Vendors By Spend</h3>
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f0ece1] border-b border-border">
                  <tr>
                    <th className="px-5 py-3 font-medium text-foreground border-r border-border">Vendor</th>
                    <th className="px-5 py-3 font-medium text-foreground border-r border-border">Spend (₹)</th>
                    <th className="px-5 py-3 font-medium text-foreground">POs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendors.slice(0, 3).map((v: any) => (
                    <tr key={v.id}>
                      <td className="px-5 py-3 border-r border-border text-foreground">{v.name}</td>
                      <td className="px-5 py-3 border-r border-border text-foreground">{Number(v.total_spent).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-foreground">{v.po_count}</td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-center text-muted-foreground">No vendor data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Monthly Trend</h3>
            <Card className="shadow-sm border-border bg-card overflow-hidden">
              <CardContent className="p-6 h-48 flex items-end justify-between gap-2 border-b border-border pt-12">
                {trends.map((t: any, index: number) => {
                  const isCurrent = index === trends.length - 1;
                  const maxSpend = Math.max(...trends.map((tr: any) => Number(tr.spend)), 1000);
                  const heightPercent = Math.max(10, (Number(t.spend) / maxSpend) * 100);
                  
                  return (
                    <div key={t.month} className="flex flex-col items-center gap-2 flex-1 group">
                      <div 
                        className={`w-full rounded-sm transition-all ${isCurrent ? 'bg-blue-700 shadow-sm' : 'bg-blue-300'}`} 
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                      <span className={`text-xs ${isCurrent ? 'font-bold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground'}`}>
                        {t.month.substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

    </div>
  );
}
