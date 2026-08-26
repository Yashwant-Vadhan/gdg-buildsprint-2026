import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const ELEMENT_ID = 'admin-qr-scanner-region';

export default function QRScannerModal({ open, onClose, onScan, banner, title = 'Scan pickup QR' }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let stopped = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped) return;
      const scanner = new Html5Qrcode(ELEMENT_ID);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!stopped) onScan(decodedText);
          },
          () => {}
        )
        .catch(() => {});
    });

    return () => {
      stopped = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {}));
      }
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {banner && (
          <div
            className={`mb-3 rounded-lg p-3 text-xs font-bold uppercase tracking-wide ${
              banner.tone === 'success'
                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                : banner.tone === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
            }`}
          >
            {banner.message}
          </div>
        )}

        <div id={ELEMENT_ID} className="w-full rounded-lg overflow-hidden" />
      </div>
    </div>
  );
}
