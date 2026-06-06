'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { FrontendRoutes } from '@/constants/frontend_route';
import { cn } from '@/lib/utils'; // Assuming this exists, if not I will just use standard classes or create it.

import { hasAccess, Role } from '@/constants/rbac';
import { useAuth } from '@/context/AuthContext';

const menuItems = [
  { name: 'Dashboard', path: FrontendRoutes.DASHBOARD, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Vendors', path: FrontendRoutes.VENDORS, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { name: 'RFQs', path: FrontendRoutes.RFQS, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { name: 'Quotations', path: FrontendRoutes.QUOTATIONS, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { name: 'Approvals', path: FrontendRoutes.APPROVALS, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Purchase Orders', path: FrontendRoutes.PURCHASE_ORDERS, icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { name: 'Invoices', path: FrontendRoutes.INVOICES, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { name: 'Reports', path: FrontendRoutes.REPORTS, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'Activity', path: FrontendRoutes.ACTIVITY, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  // Filter items based on user's role
  const visibleItems = menuItems.filter(item => hasAccess(user?.role as Role, item.path));

  return (
    <div className="w-64 bg-white border-r h-[calc(100vh-4rem)] sticky top-16 hidden md:block">
      <nav className="p-4 space-y-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== FrontendRoutes.DASHBOARD && pathname.startsWith(item.path));
          return (
            <Link key={item.name} href={item.path}>
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.name}
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
