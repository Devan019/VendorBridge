'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import axios_api from '@/lib/axios_api';
import { FrontendRoutes } from '@/constants/frontend_route';
import { Users, Building2, FileText, DollarSign, ChevronRight } from 'lucide-react';

async function fetchAdminStats() {
  const res = await axios_api.get('/admin/stats');
  return res.data.DATA?.data;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  PROCUREMENT_OFFICER: 'bg-green-100 text-green-700',
  VENDOR: 'bg-yellow-100 text-yellow-700',
};

export default function AdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
  });

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Total Vendors', value: stats?.totalVendors ?? '—', icon: Building2, color: 'text-green-600 bg-green-100' },
    { label: 'Total RFQs', value: stats?.totalRFQs ?? '—', icon: FileText, color: 'text-purple-600 bg-purple-100' },
    { label: 'Total Quotations', value: stats?.totalQuotations ?? '—', icon: DollarSign, color: 'text-orange-600 bg-orange-100' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground mt-1 text-sm">Platform overview and user management</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${card.color} mb-3`}>
              <card.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? <span className="animate-pulse bg-muted rounded h-8 w-12 inline-block" /> : card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Users by Role */}
      {!isLoading && stats?.usersByRole && (
        <div className="bg-white rounded-xl border p-6 shadow-sm mb-6">
          <h2 className="text-base font-semibold mb-4">Users by Role</h2>
          <div className="flex flex-wrap gap-3">
            {stats.usersByRole.map((r: { role: string; count: number }) => (
              <div key={r.role} className={`px-4 py-2 rounded-full text-sm font-medium ${ROLE_COLORS[r.role] ?? 'bg-muted text-muted-foreground'}`}>
                {r.role.replace('_', ' ')}: {r.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={FrontendRoutes.ADMIN_USERS}>
          <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between group">
            <div>
              <h3 className="font-semibold text-foreground">Manage Users</h3>
              <p className="text-sm text-muted-foreground mt-1">View, change roles, and remove users from the platform</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link href={FrontendRoutes.VENDORS}>
          <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between group">
            <div>
              <h3 className="font-semibold text-foreground">Manage Vendors</h3>
              <p className="text-sm text-muted-foreground mt-1">Register, update or deactivate vendors on the platform</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
