"use client"

import { createContext, useContext, useState, ReactNode } from 'react';

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
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
  };

  const logout = () => {
    setUserState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
