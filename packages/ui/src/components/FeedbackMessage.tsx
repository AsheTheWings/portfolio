'use client';

import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ShowToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show a toast notification
 */
export function showToast(type: ToastType, message: string, options?: ShowToastOptions) {
  const { description, duration = 4000, action } = options || {};

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-600" />,
    error: <XCircle className="w-4 h-4 text-red-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
    info: <Info className="w-4 h-4 text-blue-600" />,
  };

  switch (type) {
    case 'success':
      toast.success(message, { description, duration, icon: icons.success, action });
      break;
    case 'error':
      toast.error(message, { description, duration, icon: icons.error, action });
      break;
    case 'warning':
      toast.warning(message, { description, duration, icon: icons.warning, action });
      break;
    case 'info':
      toast.info(message, { description, duration, icon: icons.info, action });
      break;
  }
}

// Convenience functions
export const toastSuccess = (message: string, options?: ShowToastOptions) => showToast('success', message, options);
export const toastError = (message: string, options?: ShowToastOptions) => showToast('error', message, options);
export const toastWarning = (message: string, options?: ShowToastOptions) => showToast('warning', message, options);
export const toastInfo = (message: string, options?: ShowToastOptions) => showToast('info', message, options);

export default showToast;
