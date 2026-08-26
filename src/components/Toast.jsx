import { useEffect } from 'react';

const TONE_CLASSES = {
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
};

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${TONE_CLASSES[toast.tone] ?? TONE_CLASSES.success}`}
    >
      {toast.message}
    </div>
  );
}
