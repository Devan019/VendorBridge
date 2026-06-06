'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FrontendRoutes } from '@/constants/frontend_route';
import axios_api from '@/lib/axios_api';
import { useAuth } from '@/context/AuthContext';
import { extractApiError } from '@/lib/utils';

const signupSchema = z.object({
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'VENDOR']),
  phone: z.string().optional(),
  country: z.string().optional(),
  image: z.any().optional(),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: 'PROCUREMENT_OFFICER',
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: SignupFormValues) => {
    try {
      setServerError('');
      const formData = new FormData();
      formData.append('first_name', data.first_name);
      formData.append('last_name', data.last_name);
      formData.append('email', data.email);
      formData.append('password', data.password);
      formData.append('role', data.role);
      if (data.phone) formData.append('phone', data.phone);
      if (data.country) formData.append('country', data.country);
      if (data.image && data.image[0]) {
        formData.append('image', data.image[0]);
      }

      const res = await axios_api.post('/auth/signup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUser(res.data.DATA.user);
      router.push(FrontendRoutes.DASHBOARD);
    } catch (err: any) {
      setServerError(extractApiError(err, 'Signup failed. Please try again.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] opacity-40 z-0" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[100px] opacity-40 z-0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10 my-8"
      >
        <Card className="glass border-white/50 shadow-xl">
          <CardHeader className="space-y-2 text-center pb-6 pt-8">
            <CardTitle className="text-3xl font-bold tracking-tight">Create Account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Join VendorBridge to streamline your procurement
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <label className="text-sm font-medium leading-none">First Name</label>
                  <Input
                    {...register('first_name')}
                    placeholder="John"
                    error={errors.first_name?.message}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-sm font-medium leading-none">Last Name</label>
                  <Input
                    {...register('last_name')}
                    placeholder="Doe"
                    error={errors.last_name?.message}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Email</label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="name@example.com"
                  error={errors.email?.message}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Password</label>
                <Input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                />
              </div>

              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <label className="text-sm font-medium leading-none">Phone (Optional)</label>
                  <Input
                    {...register('phone')}
                    placeholder="+1 234 567 890"
                    error={errors.phone?.message}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-sm font-medium leading-none">Country (Optional)</label>
                  <Input
                    {...register('country')}
                    placeholder="USA"
                    error={errors.country?.message}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Profile Image (Optional)</label>
                <Input
                  {...register('image')}
                  type="file"
                  accept="image/*"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Role</label>
                <div className="relative">
                  <select
                    {...register('role')}
                    className="flex h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                    <option value="VENDOR">Vendor</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {serverError && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="text-sm font-medium text-destructive text-center"
                >
                  {serverError}
                </motion.div>
              )}

              <Button type="submit" className="w-full mt-4" isLoading={isSubmitting}>
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href={FrontendRoutes.LOGIN} className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
