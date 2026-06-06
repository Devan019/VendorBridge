import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractApiError(err: any, defaultMessage: string = 'An unexpected error occurred'): string {
  const data = err?.response?.data;
  
  if (data?.errors && Array.isArray(data.errors)) {
    return data.errors.join(' ');
  }
  
  if (data?.error && typeof data.error === 'string') {
    return data.error;
  }
  
  if (data?.message && typeof data.message === 'string') {
    return data.message;
  }
  
  if (data?.MESSAGE && typeof data.MESSAGE === 'string') {
    return data.MESSAGE;
  }
  
  return err?.message || defaultMessage;
}
