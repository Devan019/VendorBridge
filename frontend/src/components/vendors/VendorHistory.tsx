'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vendorApi, VendorNote } from '@/lib/api/vendor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { motion } from 'framer-motion';

export function VendorHistory({ vendorId }: { vendorId: string }) {
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ['vendorHistory', vendorId],
    queryFn: () => vendorApi.getVendorHistory(vendorId)
  });

  const history = historyData?.data || [];

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      await vendorApi.addVendorNote(vendorId, newNote);
      setNewNote('');
      refetch();
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 mt-6">
      <h3 className="text-lg font-bold mb-4">Vendor History & Notes</h3>
      
      <form onSubmit={handleAddNote} className="flex gap-2 mb-6">
        <Input 
          className="flex-1"
          placeholder="Add a note about this vendor..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <Button type="submit" isLoading={isSubmitting} disabled={!newNote.trim()}>
          Add Note
        </Button>
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No notes or history found.</p>
        ) : (
          history.map((note: VendorNote) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={note.id} 
              className="p-4 bg-secondary/20 rounded-lg border border-secondary"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-sm">
                  {note.created_by?.first_name} {note.created_by?.last_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-foreground">{note.note}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
