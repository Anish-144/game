// ============================================================
// QR scanner — rear camera through getUserMedia, decoded with
// jsQR on a throttled animation frame loop.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '../ui';
import { buzz } from '../lib/haptics';

type Status = 'starting' | 'scanning' | 'denied' | 'unsupported' | 'failed';

export default function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<Status>('starting');

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function begin() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        setStatus('scanning');
        tick();
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
      }
    }

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      if (doneRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const w = 320;
      const h = Math.round((video.videoHeight / video.videoWidth) * w) || 320;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      const found = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' });
      if (found?.data) {
        doneRef.current = true;
        buzz('success');
        stop();
        onResult(found.data);
      }
    }

    void begin();
    return () => { cancelled = true; stop(); };
  }, [onResult, stop]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[260px] h-[260px] rounded-3xl"
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,.62)', border: '3px solid rgba(251,191,36,.9)' }}
        />
      </div>

      <div
        className="relative mt-auto px-5 pb-8 pt-6 text-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}
      >
        <p className="text-[16px] font-semibold mb-1">
          {status === 'scanning' && 'Point at the room QR code'}
          {status === 'starting' && 'Starting the camera'}
          {status === 'denied' && 'Camera access was blocked'}
          {status === 'unsupported' && 'This browser has no camera access'}
          {status === 'failed' && 'The camera could not start'}
        </p>
        <p className="text-[13.5px] text-white/60 mb-5">
          {status === 'denied'
            ? 'Allow camera access in your browser settings, or enter the room code instead.'
            : 'The code is on the host screen under Share QR.'}
        </p>
        <Button variant="ghost" size="md" onClick={() => { stop(); onClose(); }}>
          Close
        </Button>
      </div>
    </div>
  );
}
