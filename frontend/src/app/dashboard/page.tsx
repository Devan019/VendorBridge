'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { analyticsApi } from '@/lib/api/analytics';
import { poApi, invoiceApi } from '@/lib/api/po';
import { rfqApi } from '@/lib/api/rfq';
import { approvalApi } from '@/lib/api/approval';

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    ACCEPTED:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    PENDING:   'bg-amber-100  text-amber-700  border-amber-200',
    DRAFT:     'bg-slate-100  text-slate-600  border-slate-200',
    SENT:      'bg-blue-100   text-blue-700   border-blue-200',
    REJECTED:  'bg-red-100    text-red-700    border-red-200',
    PAID:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    OVERDUE:   'bg-red-100    text-red-700    border-red-200',
  };
  const cls = map[status?.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent, icon,
}: { label: string; value: string | number; sub?: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
        <p className="text-sm font-medium text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mini Bar Chart ────────────────────────────────────────────────────────────
function SparkBar({ trends }: { trends: any[] }) {
  if (!trends || trends.length === 0) return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No trend data</div>
  );
  const max = Math.max(...trends.map((t: any) => Number(t.spend)), 1);
  return (
    <div className="flex items-end gap-1.5 h-full w-full">
      {trends.map((t: any, i: number) => {
        const pct = Math.max(8, (Number(t.spend) / max) * 100);
        const isCurrent = i === trends.length - 1;
        return (
          <div key={t.month} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-full rounded-t-sm transition-all ${isCurrent ? 'bg-primary' : 'bg-primary/30'}`}
              style={{ height: `${pct}%` }}
            />
            <span className={`text-[10px] leading-none ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
              {String(t.month).substring(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isVendor = user?.role === 'VENDOR';
  const isAdmin  = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';

  const roleLabel: Record<string, string> = {
    ADMIN:                'Admin',
    MANAGER:              'Manager',
    PROCUREMENT_OFFICER:  'Procurement Officer',
    VENDOR:               'Vendor',
  };

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['analytics', 'procurement'],
    queryFn: () => analyticsApi.getProcurementStats(),
  });

  const { data: trendsData } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: () => analyticsApi.getMonthlyTrends(),
  });

  const { data: posData } = useQuery({
    queryKey: ['pos', 'dashboard'],
    queryFn: () => poApi.listPOs({ limit: 5 }),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', 'dashboard'],
    queryFn: () => invoiceApi.listInvoices({ limit: 5 }),
  });

  const { data: rfqsData } = useQuery({
    queryKey: ['rfqs', 'dashboard'],
    queryFn: () => rfqApi.listRFQs(),
    enabled: !isVendor,
  });

  const { data: approvalsData } = useQuery({
    queryKey: ['approvals', 'pending', 'dashboard'],
    queryFn: () => approvalApi.listApprovals({ status: 'PENDING' }),
    enabled: !isVendor,
  });

  const stats       = statsData?.data;
  const trends      = trendsData?.data || [];
  const recentPOs   = posData?.data     || [];
  const invoices    = invoicesData?.data || [];
  const rfqs        = rfqsData?.data    || [];
  const approvals   = approvalsData?.data || [];

  const activeRFQs       = rfqs.filter((r: any) => ['SENT', 'DRAFT'].includes(r.status)).length;
  const pendingApprovals = approvals.length;
  const overdueInvoices  = invoices.filter((inv: any) => inv.status === 'OVERDUE').length;
  const totalSpend       = Number(stats?.total_spend || 0);
  const displaySpend = totalSpend >= 100000
    ? `₹${(totalSpend / 100000).toFixed(1)}L`
    : `₹${totalSpend.toLocaleString('en-IN')}`;

  const firstName = user?.first_name || 'User';

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Welcome back, <span className="font-semibold text-foreground">{firstName}</span>
            {user?.role && (
              <span className="ml-1 text-muted-foreground/70">
                — {roleLabel[user.role] ?? user.role} · Today's Overview
              </span>
            )}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {!isVendor && (
            <button
              onClick={() => router.push('/dashboard/quotations')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New RFQ
            </button>
          )}
          {(isAdmin || isManager) && (
            <button
              onClick={() => router.push('/dashboard/vendors')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              Add Vendor
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/invoices')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors"
          >
            View Invoices
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {!isVendor && (
          <KpiCard
            label="Active RFQs"
            value={activeRFQs}
            sub="Sent & Draft"
            accent="bg-blue-100 text-blue-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        )}
        {!isVendor && (
          <KpiCard
            label="Pending Approvals"
            value={pendingApprovals}
            sub="Awaiting review"
            accent="bg-amber-100 text-amber-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        )}
        <KpiCard
          label="POs This Month"
          value={displaySpend}
          sub={`${stats?.active_vendors ?? 0} active vendors`}
          accent="bg-emerald-100 text-emerald-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <KpiCard
          label="Overdue Invoices"
          value={overdueInvoices}
          sub="Require action"
          accent="bg-red-100 text-red-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        {isVendor && (
          <KpiCard
            label="PO Fulfillment"
            value={stats?.po_fulfillment_rate ? `${Number(stats.po_fulfillment_rate).toFixed(0)}%` : '—'}
            sub="Your performance"
            accent="bg-purple-100 text-purple-600"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        )}
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Purchase Orders table — takes 2 cols */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Purchase Orders</h2>
            <button
              onClick={() => router.push('/dashboard/invoices')}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">PO #</th>
                  <th className="px-5 py-3 text-left font-medium">Vendor</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentPOs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                      No purchase orders yet.{' '}
                      {!isVendor && (
                        <button onClick={() => router.push('/dashboard/quotations/compare')} className="text-primary hover:underline">
                          Start by comparing quotations →
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  recentPOs.slice(0, 5).map((po: any) => (
                    <tr key={po.id} className="hover:bg-secondary/10 transition-colors cursor-pointer" onClick={() => router.push('/dashboard/invoices')}>
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-foreground">{po.po_number}</td>
                      <td className="px-5 py-3.5 text-foreground">{po.vendor?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">
                        ₹{Number(po.grand_total ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={po.status ?? 'DRAFT'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Spending Trend Chart — 1 col */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Spending Trend</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <div className="flex-1 p-5 h-52">
            <SparkBar trends={trends.slice(-6)} />
          </div>
          {stats && (
            <div className="px-5 py-3 border-t border-border bg-secondary/20 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Spend</span>
              <span className="text-sm font-bold text-foreground">{displaySpend}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Panels ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending Approvals (hidden for vendors) */}
        {!isVendor && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
              <button
                onClick={() => router.push('/dashboard/approvals')}
                className="text-xs text-primary hover:underline font-medium"
              >
                Review all →
              </button>
            </div>
            <div className="divide-y divide-border">
              {approvals.length === 0 ? (
                <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                  🎉 No pending approvals! All caught up.
                </div>
              ) : (
                approvals.slice(0, 4).map((ap: any) => (
                  <div key={ap.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/10 cursor-pointer transition-colors" onClick={() => router.push('/dashboard/approvals')}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {ap.quotation?.rfq?.title ?? 'Quotation Review'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vendor: {ap.quotation?.vendor?.name ?? '—'} · Level {ap.level}
                      </p>
                    </div>
                    <StatusBadge status={ap.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Recent Invoices */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Invoices</h2>
            <button
              onClick={() => router.push('/dashboard/invoices')}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-border">
            {invoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No invoices yet.
              </div>
            ) : (
              invoices.slice(0, 4).map((inv: any) => (
                <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/10 cursor-pointer transition-colors" onClick={() => router.push('/dashboard/invoices')}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.invoice_number ?? inv.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      ₹{Number(inv.amount ?? 0).toLocaleString('en-IN')}
                    </p>
                    <StatusBadge status={inv.status ?? 'PENDING'} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active RFQs (for non-vendors) OR Vendor Quotation Tip */}
        {isVendor ? (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl shadow-sm p-6 flex flex-col items-start justify-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Submit a Quotation</h3>
              <p className="text-sm text-muted-foreground mt-1">Browse open RFQs and submit your best quote. Approved quotes lead to purchase orders.</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/quotations')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Submit Quote →
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Active RFQs</h2>
              <button
                onClick={() => router.push('/dashboard/quotations')}
                className="text-xs text-primary hover:underline font-medium"
              >
                Manage →
              </button>
            </div>
            <div className="divide-y divide-border">
              {rfqs.length === 0 ? (
                <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                  No RFQs found.{' '}
                  <button onClick={() => router.push('/dashboard/rfq')} className="text-primary hover:underline">
                    Create one →
                  </button>
                </div>
              ) : (
                rfqs.slice(0, 4).map((rfq: any) => (
                  <div key={rfq.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-secondary/10 cursor-pointer transition-colors" onClick={() => router.push('/dashboard/quotations/compare')}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{rfq.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{rfq.reference_number} · Deadline: {new Date(rfq.deadline).toLocaleDateString()}</p>
                    </div>
                    <StatusBadge status={rfq.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
