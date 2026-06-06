'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { vendorApi } from '@/lib/api/vendor';
import { extractApiError } from '@/lib/utils';

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  gst_number: z.string().min(1, 'GST Number is required'),
  contact_email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).default("ACTIVE"),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

export function VendorFormModal({ 
  isOpen, 
  onClose,
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      status: "ACTIVE"
    }
  });

  const onSubmit = async (data: VendorFormValues) => {
    try {
      setServerError('');
      await vendorApi.createVendor(data);
      reset();
      onSuccess();
    } catch (err: any) {
      setServerError(extractApiError(err, 'Failed to register vendor.'));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-6">Register New Vendor</h2>
            
            {serverError && <div className="text-sm font-medium text-destructive mb-4">{serverError}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Vendor Name <span className="text-destructive">*</span></label>
                  <Input {...register('name')} placeholder="Acme Corp" error={errors.name?.message} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Category <span className="text-destructive">*</span></label>
                  <Input {...register('category')} placeholder="Hardware" error={errors.category?.message} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">GST Number <span className="text-destructive">*</span></label>
                  <Input {...register('gst_number')} placeholder="22AAAAA0000A1Z5" error={errors.gst_number?.message} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Contact Email <span className="text-destructive">*</span></label>
                  <Input {...register('contact_email')} type="email" placeholder="contact@acme.com" error={errors.contact_email?.message} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Phone</label>
                  <Input {...register('phone')} placeholder="+1 234 567 890" error={errors.phone?.message} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Status</label>
                  <select
                    {...register('status')}
                    className="flex h-10 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="BLACKLISTED">Blacklisted</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Address</label>
                <Input {...register('address')} placeholder="123 Tech Park, Innovation City" error={errors.address?.message} />
              </div>

              <div className="flex justify-end pt-4 gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" isLoading={isSubmitting}>Register Vendor</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
