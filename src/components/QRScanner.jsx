import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const ELEMENT_ID = 'qr-scanner-region';

/**
 * Wraps html5-qrcode's device-camera scanner. Calls onScan(decodedText) once per
 * successful decode; the caller is responsible for pausing/closing after a scan
 * (e.g. by unmounting this component inside a Modal).
 */
export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!stopped) {
            onScan(decodedText);
          }
        },
        () => {
          // per-frame decode failures are expected while aiming the camera — ignore
        }
      )
      .catch((err) => {
        onError?.(err);
      });

    return () => {
      stopped = true;
      scanner.stop().catch(() => {}).finally(() => {
        scanner.clear().catch(() => {});
      });
    };
  }, [onScan, onError]);

  return <div id={ELEMENT_ID} className="w-full rounded-lg overflow-hidden" />;
}
