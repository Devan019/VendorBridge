'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { rfqApi, RFQItem, RFQStatus } from '@/lib/api/rfq';
import { vendorApi, Vendor } from '@/lib/api/vendor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FrontendRoutes } from '@/constants/frontend_route';
import { Trash2, Plus, UploadCloud, X, Play } from 'lucide-react';

export default function NewRFQPage() {
  const router = useRouter();
  
  // Basic Info
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  
  // Items
  const [items, setItems] = useState<RFQItem[]>([
    { product_name: '', quantity: 1, unit: 'pcs', description: '' }
  ]);
  
  // Vendors
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showVendorSelect, setShowVendorSelect] = useState(false);
  
  // Files
  const [files, setFiles] = useState<File[]>([]);
  
  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch registered vendors for assignment
  const { data: vendorsData, isLoading: isLoadingVendors } = useQuery({
    queryKey: ['vendors', 'list'],
    queryFn: () => vendorApi.listVendors()
  });
  const vendorsList: Vendor[] = vendorsData?.data || [];

  const handleAddItem = () => {
    setItems([...items, { product_name: '', quantity: 1, unit: 'pcs', description: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof RFQItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleVendorToggle = (vendorId: string) => {
    if (selectedVendors.includes(vendorId)) {
      setSelectedVendors(selectedVendors.filter(id => id !== vendorId));
    } else {
      setSelectedVendors([...selectedVendors, vendorId]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!title.trim()) return "Title is required.";
    if (!description.trim()) return "Description is required.";
    if (!deadline) return "Deadline is required.";
    if (items.length === 0) return "At least one line item is required.";
    for (const item of items) {
      if (!item.product_name.trim()) return "All items must have a product name.";
      if (item.quantity < 1) return "Quantity must be at least 1.";
      if (!item.unit.trim()) return "Unit is required for all items.";
    }
    return null;
  };

  const handleSubmit = async (status: RFQStatus) => {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create RFQ
      const rfqPayload = {
        title: title.trim(),
        description: description.trim(),
        deadline: new Date(deadline).toISOString(),
        items: items,
        vendor_ids: selectedVendors,
        status: status
      };

      const rfqResponse = await rfqApi.createRFQ(rfqPayload);
      const rfqId = rfqResponse?.data?.id;

      if (!rfqId) throw new Error("Failed to extract RFQ ID after creation.");

      // 2. Upload Files if any
      if (files.length > 0) {
        for (const file of files) {
          await rfqApi.uploadAttachment(rfqId, file);
        }
      }

      // 3. Redirect
      router.push(FrontendRoutes.RFQS);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.ERROR || err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 px-4 pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create RFQ's</h1>
        <p className="text-muted-foreground mt-1 text-sm tracking-wide lowercase">new request for quotation</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
        
        {/* Left Column (Step 1) */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">RFQ's title*</label>
            <Input 
              className="rounded-xl border-border bg-transparent shadow-none h-11"
              placeholder="e.g. Office Furniture procurement Q2" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Category</label>
            <Input 
              className="rounded-xl border-border bg-transparent shadow-none h-11"
              placeholder="e.g. Furniture" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Deadline*</label>
            <Input 
              className="rounded-xl border-border bg-transparent shadow-none h-11"
              type="date" 
              value={deadline} 
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
            <textarea 
              className="flex min-h-[120px] w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-none"
              placeholder="Ergonomic chairs and standing desks for 3rd floor"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Right Column (Step 2) */}
        <div className="space-y-10">
          <div>
            <label className="block text-sm font-medium mb-2 uppercase text-foreground">Line items</label>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">item</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">qty</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Unit</th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-secondary/10">
                      <td className="p-0">
                        <input 
                          className="w-full h-full bg-transparent px-4 py-3 outline-none text-foreground placeholder:text-muted-foreground/50" 
                          placeholder="Item name"
                          value={item.product_name}
                          onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                        />
                      </td>
                      <td className="p-0">
                        <input 
                          type="number"
                          className="w-full h-full bg-transparent px-4 py-3 outline-none text-foreground" 
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </td>
                      <td className="p-0">
                        <input 
                          className="w-full h-full bg-transparent px-4 py-3 outline-none text-foreground uppercase" 
                          placeholder="NOS"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        />
                      </td>
                      <td className="p-0 text-center">
                        <button 
                          className="text-muted-foreground hover:text-destructive px-2"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button 
              type="button" 
              className="mt-3 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-secondary transition-colors inline-flex items-center gap-2"
              onClick={handleAddItem}
            >
              + add line item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 uppercase text-foreground">ASSIGN VENDORS</label>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border max-h-40 overflow-y-auto">
                {selectedVendors.map(vid => {
                  const vendor = vendorsList.find(v => v.id === vid);
                  return (
                    <div key={vid} className="flex justify-between items-center px-4 py-3 hover:bg-secondary/10">
                      <span className="text-sm text-foreground">{vendor?.name || 'Unknown Vendor'}</span>
                      <button onClick={() => handleVendorToggle(vid)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {selectedVendors.length === 0 && !showVendorSelect && (
                  <div className="px-4 py-3 text-sm text-muted-foreground italic">No vendors assigned yet.</div>
                )}
              </div>
              
              {showVendorSelect ? (
                <div className="p-3 border-t border-border bg-secondary/5">
                  <select 
                    className="w-full bg-transparent border border-border rounded-lg p-2 text-sm outline-none"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleVendorToggle(e.target.value);
                        setShowVendorSelect(false);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select a vendor...</option>
                    {vendorsList.filter(v => v.status === 'ACTIVE' && !selectedVendors.includes(v.id)).map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <button 
                  type="button" 
                  className="w-full px-4 py-3 border-t border-border text-sm text-left text-foreground hover:bg-secondary/50 transition-colors"
                  onClick={() => setShowVendorSelect(true)}
                >
                  + add vendor
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border my-12 max-w-5xl mx-auto"></div>

      {/* Bottom Section (Step 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
        
        {/* Left Bottom */}
        <div className="flex flex-col gap-4 justify-start pt-8 w-full max-w-[280px]">
          <button 
            className="w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium hover:bg-primary/5 hover:border-primary/50 transition-colors"
            onClick={() => handleSubmit('SENT')}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Publishing..." : "Save & Send to Vendors"}
          </button>
          <button 
            className="w-full py-2.5 px-4 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
            onClick={() => handleSubmit('DRAFT')}
            disabled={isSubmitting}
          >
            Save as Draft
          </button>
        </div>

        {/* Right Bottom */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">Attachments</label>
          <div className="border border-border rounded-xl p-8 text-center bg-transparent relative group hover:border-primary/50 transition-colors">
            <p className="text-sm text-foreground">Drag & drop files or click to upload</p>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-primary/80 group-hover:text-primary transition-colors">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <input 
              type="file" 
              multiple 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex justify-between items-center p-3 border border-border rounded-xl text-sm bg-secondary/10">
                  <span className="truncate max-w-[80%]">{file.name}</span>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveFile(index)}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
