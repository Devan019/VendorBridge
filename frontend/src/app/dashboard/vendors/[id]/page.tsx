'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { vendorApi, VendorStatus } from '@/lib/api/vendor';
import { Button } from '@/components/ui/Button';
import { VendorHistory } from '@/components/vendors/VendorHistory';
import { FrontendRoutes } from '@/constants/frontend_route';

export default function VendorProfilePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: vendorData, isLoading, refetch } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorApi.getVendor(id)
  });

  const vendor = vendorData?.data;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await vendorApi.updateVendor(id, { status: newStatus as VendorStatus });
      refetch();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this vendor?')) {
      try {
        await vendorApi.deleteVendor(id);
        router.push(FrontendRoutes.VENDORS);
      } catch (err) {
        console.error('Failed to delete vendor', err);
      }
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading vendor details...</div>;
  if (!vendor) return <div className="p-8 text-center text-destructive">Vendor not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href={FrontendRoutes.VENDORS} className="hover:text-primary transition-colors">
          &larr; Back to Vendors
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 relative">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                vendor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                vendor.status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {vendor.status}
              </span>
            </div>
            <p className="text-muted-foreground">GST: <span className="font-mono text-foreground">{vendor.gst_number}</span> &bull; Category: <span className="font-medium text-foreground">{vendor.category}</span></p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              className="flex h-10 w-full md:w-auto appearance-none rounded-md border border-input bg-transparent px-4 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={vendor.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="ACTIVE">Mark as Active</option>
              <option value="INACTIVE">Mark as Inactive</option>
              <option value="BLACKLISTED">Blacklist Vendor</option>
            </select>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t">
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Contact Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${vendor.contact_email}`} className="text-primary hover:underline">{vendor.contact_email}</a>
              </div>
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{vendor.phone}</span>
                </div>
              )}
              {vendor.address && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="leading-relaxed">{vendor.address}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Metadata & Tags</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Registered</span>
                <span className="font-medium">{new Date(vendor.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">{new Date(vendor.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground block mb-2">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {vendor.tags && vendor.tags.length > 0 ? (
                    vendor.tags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic text-xs">No tags added.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VendorHistory vendorId={id} />
    </div>
  );
}
