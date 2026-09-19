// ============================================================
// QR code — rendered as inline SVG so it stays crisp and can
// be handed straight to the native share sheet.
// ============================================================

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function useQrSvg(value: string, size = 220) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!value) { setSvg(''); return; }
    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: { dark: '#0b1118', light: '#ffffff' },
    })
      .then((markup: string) => { if (!cancelled) setSvg(markup); })
      .catch(() => { if (!cancelled) setSvg(''); });
    return () => { cancelled = true; };
  }, [value, size]);

  return svg;
}

export default function QrCode({
  value,
  size = 220,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  const svg = useQrSvg(value, size);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-3xl bg-white p-3.5"
        style={{ width: size + 28, height: size + 28, boxShadow: '0 12px 34px rgba(0,0,0,.45)' }}
      >
        {svg ? (
          <div
            className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
            aria-label="Room invite QR code"
            role="img"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="w-full h-full rounded-2xl bg-neutral-200 animate-pulse" />
        )}
      </div>
      {caption && <p className="text-[13px] text-white/55 text-center max-w-[260px]">{caption}</p>}
    </div>
  );
}
