'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '../ui/Button';
import { useRouter } from 'next/navigation';
import { FrontendRoutes } from '@/constants/frontend_route';

export function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push(FrontendRoutes.HOME);
  };

  if (isLoading) {
    return (
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <div className="h-8 w-32 bg-gray-200 animate-pulse rounded"></div>

        <div className="flex gap-4">
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href={FrontendRoutes.HOME} className="text-xl font-bold tracking-tight">
              Vendor<span className="text-gray-400">Bridge</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 mr-2">
                  {user?.image_url ? (
                    <img
                      src={user.image_url}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                      {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {user?.first_name} {user?.last_name}
                  </span>
                </div>
                <Link href={FrontendRoutes.DASHBOARD}>
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href={FrontendRoutes.LOGIN}>
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href={FrontendRoutes.REGISTER}>
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
