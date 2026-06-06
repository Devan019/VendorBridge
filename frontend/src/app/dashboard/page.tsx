'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import axios_api from '@/lib/axios_api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>Dashboard</div>
  )
}
