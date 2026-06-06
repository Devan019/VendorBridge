'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { hasAccess, Role } from '@/constants/rbac';
import { FrontendRoutes } from '@/constants/frontend_route';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(FrontendRoutes.LOGIN);
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect in useEffect
  }

  const isAllowed = hasAccess(user.role as Role, pathname);

  const roleLabel: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    PROCUREMENT_OFFICER: 'Procurement Officer',
    VENDOR: 'Vendor',
  };

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <ShieldAlert className="w-16 h-16 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground max-w-md mb-2">
          Your role <span className="font-semibold text-foreground">{roleLabel[user.role] ?? user.role}</span> does not have permission to view this page.
        </p>
        <p className="text-sm text-muted-foreground max-w-md mb-8">
          If you believe this is an error, please contact your administrator.
        </p>
        <button
          onClick={() => router.push(FrontendRoutes.DASHBOARD)}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
