'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios_api from '@/lib/axios_api';
import { FormError } from '@/components/ui/FormError';
import { Search, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

type Role = 'ADMIN' | 'MANAGER' | 'PROCUREMENT_OFFICER' | 'VENDOR';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  phone?: string;
  country?: string;
  created_at: string;
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  PROCUREMENT_OFFICER: 'bg-green-100 text-green-700',
  VENDOR: 'bg-yellow-100 text-yellow-700',
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  PROCUREMENT_OFFICER: 'Officer',
  VENDOR: 'Vendor',
};

async function fetchUsers(search: string, role: string) {
  const params: any = {};
  if (search) params.search = search;
  if (role) params.role = role;
  const res = await axios_api.get('/admin/users', { params });
  return res.data.DATA;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter],
    queryFn: () => fetchUsers(search, roleFilter),
  });

  const users: User[] = data?.data ?? [];

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      axios_api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      toast.success('User role updated!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.ERROR || 'Failed to update role.');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => axios_api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User removed.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.ERROR || 'Failed to delete user.');
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Users</h1>
        <p className="text-muted-foreground mt-1 text-sm">View all users, change their roles, or remove them</p>
      </div>

      <FormError error={error} className="mb-6" />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="PROCUREMENT_OFFICER">Officer</option>
          <option value="VENDOR">Vendor</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <select
                        value={user.role}
                        onChange={e => updateRoleMutation.mutate({ id: user.id, role: e.target.value })}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer appearance-none pr-6 ${ROLE_COLORS[user.role]}`}
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="PROCUREMENT_OFFICER">Officer</option>
                        <option value="VENDOR">Vendor</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${user.first_name} ${user.last_name}?`)) {
                          deleteUserMutation.mutate(user.id);
                        }
                      }}
                      className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data?.pagination && (
          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            Showing {users.length} of {data.pagination.total} users
          </div>
        )}
      </div>
    </div>
  );
}
