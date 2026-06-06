'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/lib/api/activity';

const filters = ['All', 'RFQ', 'Approval', 'Invoice', 'Vendor', 'Quotation', 'PurchaseOrder'];

export default function ActivityLogsPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  const { data: activityData, isLoading } = useQuery({
    queryKey: ['activity', activeFilter],
    queryFn: () => activityApi.listActivity(activeFilter !== 'All' ? { entity_type: activeFilter } : {})
  });

  const logs = activityData?.data || [];

  const getIcon = (type: string) => {
    switch(type) {
      case 'Approval':
      case 'Quotation':
        return {
          svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />,
          color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-500'
        };
      case 'RFQ':
        return {
          svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
          color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-600'
        };
      case 'Vendor':
        return {
          svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
          color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-500'
        };
      default:
        return {
          svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
          color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-500'
        };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Activity & Logs</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Procurement audit trail
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-3">
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-6 py-2 text-sm font-medium rounded-md border transition-colors ${
              activeFilter === filter
                ? 'bg-blue-100 text-blue-800 border-blue-400'
                : 'bg-card text-muted-foreground border-border hover:bg-secondary/50'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="pt-4 space-y-0">
        {isLoading ? (
          <div className="py-10 text-center">Loading...</div>
        ) : logs.map((log: any) => {
          const iconDef = getIcon(log.entity_type);
          return (
            <div key={log.id} className="group flex gap-5 py-5 border-b border-border last:border-0 hover:bg-secondary/10 px-2 -mx-2 rounded-lg transition-colors">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${iconDef.bg} ${iconDef.border}`}>
                  <svg className={`w-5 h-5 ${iconDef.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {iconDef.svg}
                  </svg>
                </div>
              </div>
              
              {/* Content */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {log.entity_type} {log.action} <span className="font-normal text-muted-foreground">- {log.entity_id}</span>
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  {new Date(log.timestamp).toLocaleString()} by {log.user?.name || log.performed_by}
                </p>
              </div>
            </div>
          );
        })}
        
        {!isLoading && logs.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            No activity found for {activeFilter}.
          </div>
        )}
      </div>

    </div>
  );
}
