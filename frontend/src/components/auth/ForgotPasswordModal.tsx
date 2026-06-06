'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import axios_api from '@/lib/axios_api';

export function ForgotPasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios_api.post('/auth/forgot-password', { email });
      setResetToken(res.data.data.reset_token); // Pre-fill token since email isn't actually sent in demo
      setStep(2);
      setSuccess('Token generated! Proceed to reset password.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios_api.post('/auth/reset-password', { reset_token: resetToken, password: newPassword });
      setSuccess('Password reset successfully! You can now log in.');
      setTimeout(() => {
        onClose();
        setStep(1);
        setEmail('');
        setResetToken('');
        setNewPassword('');
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
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
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4">{step === 1 ? 'Forgot Password' : 'Reset Password'}</h2>
            
            {error && <div className="text-sm text-destructive mb-4">{error}</div>}
            {success && <div className="text-sm text-green-600 mb-4">{success}</div>}

            {step === 1 ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={loading}>
                  Request Reset Token
                </Button>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Reset Token</label>
                  <Input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    placeholder="Token"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Pre-filled for demonstration purposes</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={loading}>
                  Reset Password
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
