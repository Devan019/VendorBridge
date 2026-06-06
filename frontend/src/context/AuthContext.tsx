"use client"

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axios_api from '@/lib/axios_api';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  country?: string | null;
  image_url?: string | null;
  role: 'ADMIN' | 'MANAGER' | 'PROCUREMENT_OFFICER' | 'VENDOR';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, SetIsAuthenticated] =  useState <boolean>(false);

  useEffect(() => {
    const fetchUser = async () => {
      SetIsAuthenticated(false);
      try {
        const res = await axios_api.get('/auth/me');
        SetIsAuthenticated(true);
        setUserState(res.data.DATA.user);
      } catch (error) {
        setUserState(null);
        SetIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUser();
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    SetIsAuthenticated(true);
  };

  const logout = async () => {
    // Best-effort: tell the server to delete the refresh token from DB + clear its cookies.
    // We always clear local state afterwards regardless of whether the server call succeeds.
    try {
      await axios_api.post('/auth/logout');
    } catch {
      // Server-side revoke failed (e.g. already expired). Still clear local state.
    } finally {
      SetIsAuthenticated(false);
      setUserState(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
