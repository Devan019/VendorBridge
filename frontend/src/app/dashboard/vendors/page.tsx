'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { vendorApi } from '@/lib/api/vendor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VendorFormModal } from '@/components/vendors/VendorFormModal';

export default function VendorsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Real debounce
  // ... let's skip strict debounce for simplicity, or implement it inline if needed

  const { data: vendorsData, isLoading, refetch } = useQuery({
    queryKey: ['vendors', debouncedSearch, statusFilter, categoryFilter],
    queryFn: () => vendorApi.listVendors({
      search: debouncedSearch,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      limit: 50
    })
  });

  const vendors = vendorsData?.data || [];
  const meta = vendorsData?.meta;

  const { data: categoriesData } = useQuery({
    queryKey: ['vendorCategories'],
    queryFn: () => vendorApi.listCategories()
  });

  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor directory and partnerships.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Register Vendor
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input 
              placeholder="Search vendors by name or GST..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDebouncedSearch(e.target.value); // Simple immediate for now
              }}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              className="flex h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLACKLISTED">Blacklisted</option>
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              className="flex h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Vendor</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">GST Number</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Loading vendors...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No vendors found matching your criteria.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor: any) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={vendor.id} 
                    className="border-b last:border-0 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {vendor.name}
                      <div className="text-xs text-muted-foreground font-normal">{vendor.contact_email}</div>
                    </td>
                    <td className="px-4 py-3">{vendor.category}</td>
                    <td className="px-4 py-3 font-mono text-xs">{vendor.gst_number}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        vendor.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/vendors/${vendor.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VendorFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
