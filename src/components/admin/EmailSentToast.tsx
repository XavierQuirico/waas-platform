'use client';

import { useEffect } from 'react';
import { Mail, X } from 'lucide-react';

interface EmailSentToastProps {
  emailId: string;       // E03, E08, etc.
  recipientEmail: string;
  emailName: string;
  onDismiss: () => void;
  /** Auto-dismiss en ms. Default: 5000 */
  duration?: number;
}

export function EmailSentToast({
  emailId,
  recipientEmail,
  emailName,
  onDismiss,
  duration = 5000,
}: EmailSentToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg">
      <Mail size={16} className="mt-0.5 shrink-0 text-green-600" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium text-green-800">
          Email enviado ({emailId})
        </p>
        <p className="text-xs text-green-700">{emailName}</p>
        <p className="text-xs text-green-500">a {recipientEmail}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-green-400 hover:text-green-600"
        aria-label="Cerrar"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
