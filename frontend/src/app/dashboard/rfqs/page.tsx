'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { rfqApi, RFQ } from '@/lib/api/rfq';
import { FrontendRoutes } from '@/constants/frontend_route';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, FileText, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {motion} from "framer-motion"

export default function RFQDashboardPage() {
  const { user } = useAuth();
  const isVendor = user?.role === 'VENDOR';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: responseData, isLoading } = useQuery({
    queryKey: ['rfqs', 'list', searchQuery, statusFilter],
    queryFn: () => rfqApi.listRFQs({ 
      search: searchQuery, 
      status: statusFilter || undefined 
    })
  });

  const rfqs: RFQ[] = responseData?.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      case 'SENT': return 'bg-blue-100 text-blue-700';
      case 'CLOSED': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Requests for Quotation</h1>
          <p className="text-muted-foreground mt-1">Manage and track your active and past RFQs.</p>
        </div>
        {!isVendor && (
          <Link href={FrontendRoutes.NEW_RFQ}>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New RFQ
            </Button>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-9 w-full" 
            placeholder="Search by title or reference number..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full md:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse h-48"></div>
          ))}
        </div>
      ) : rfqs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No RFQs Found</h3>
          <p className="text-muted-foreground mb-6">You haven't created any requests that match this criteria.</p>
          <Link href={FrontendRoutes.NEW_RFQ}>
            <Button variant="outline">Create Your First RFQ</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rfqs.map((rfq: RFQ, index: number) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={rfq.id}
            >
              <Link href={`${FrontendRoutes.RFQS}/${rfq.id}`} className="block h-full">
                <div className="bg-white rounded-xl border p-5 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full flex flex-col group relative overflow-hidden">
                  
                  {/* Accent strip based on status */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    rfq.status === 'SENT' ? 'bg-blue-500' :
                    rfq.status === 'CLOSED' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />

                  <div className="flex justify-between items-start mb-3 pl-2">
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                      {rfq.reference_number}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusColor(rfq.status)}`}>
                      {rfq.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg mb-2 text-foreground line-clamp-2 pl-2 group-hover:text-primary transition-colors">
                    {rfq.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow pl-2">
                    {rfq.description}
                  </p>

                  <div className="mt-auto space-y-2 pl-2 border-t pt-4">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 mr-2" />
                      Created: {new Date(rfq.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 mr-2" />
                      Deadline: {new Date(rfq.deadline).toLocaleString()}
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs font-medium text-foreground bg-secondary px-2 py-1 rounded-md">
                        {rfq._count?.items || 0} Items
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
