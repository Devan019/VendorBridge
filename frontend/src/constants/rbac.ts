import { FrontendRoutes } from "./frontend_route";

export type Role = 'ADMIN' | 'MANAGER' | 'PROCUREMENT_OFFICER' | 'VENDOR';

// Define which roles have access to which base routes
export const RoutePermissions: Record<string, Role[]> = {
  [FrontendRoutes.DASHBOARD]: ['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'VENDOR'],
  [FrontendRoutes.VENDORS]: ['ADMIN', 'PROCUREMENT_OFFICER'],
  [FrontendRoutes.RFQS]: ['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'VENDOR'], // Note: specific actions inside RFQs will be checked, but list view is available to all
  [FrontendRoutes.QUOTATIONS]: ['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR'],
  [FrontendRoutes.APPROVALS]: ['ADMIN', 'MANAGER'],
  [FrontendRoutes.INVOICES]: ['ADMIN', 'PROCUREMENT_OFFICER'],
  [FrontendRoutes.REPORTS]: ['ADMIN', 'MANAGER'],
  [FrontendRoutes.ACTIVITY]: ['ADMIN', 'MANAGER'],
  [FrontendRoutes.ADMIN]: ['ADMIN'],
  [FrontendRoutes.ADMIN_USERS]: ['ADMIN'],
  [FrontendRoutes.ADMIN_ANALYTICS]: ['ADMIN'],
};

/**
 * Check if a role has access to a specific path.
 * Matches route prefixes, so `/dashboard/rfqs/new` falls under `/dashboard/rfqs`.
 */
export function hasAccess(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  
  // Find the longest matching route prefix in our permissions map
  const matchingRoutes = Object.keys(RoutePermissions).filter(route => 
    path === route || path.startsWith(`${route}/`)
  );
  
  if (matchingRoutes.length === 0) {
    // If it's not explicitly protected here, we might default to allow or deny.
    // For safety, if it's under /dashboard, we deny. Otherwise allow (like /login).
    return !path.startsWith('/dashboard');
  }

  // Sort by length descending to get the most specific match
  matchingRoutes.sort((a, b) => b.length - a.length);
  const mostSpecificRoute = matchingRoutes[0];
  
  return RoutePermissions[mostSpecificRoute].includes(role);
}
