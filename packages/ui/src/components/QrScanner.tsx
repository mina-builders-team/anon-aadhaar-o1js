'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, Result } from '@zxing/library';

interface QrScannerProps {
  onScan?: (qrNumericString: string) => void;
  isEnabled: boolean;
}

export const QrScanner = ({
  onScan,
  isEnabled = true,
}: QrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const onScanRef = useRef<QrScannerProps['onScan']>(onScan);
  const lastTextRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      try {
        controlsRef.current?.stop();
      } catch {
        console.error('Failed to stop video controls');
      }
      controlsRef.current = null;
      readerRef.current = null;
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {
          console.error('Failed to pause video');
        }
        if (v.srcObject) {
          (v.srcObject as MediaStream)
            .getTracks()
            .forEach((t) => t.stop());
          v.srcObject = null;
        }
        v.removeAttribute('src');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setScanning(false);
    };

    const start = async () => {
      if (!isEnabled) {
        stop();
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      setScanning(true);
      setError(null);
      lastTextRef.current = null;

      try {
        // Get the stream ourselves to avoid ZXing reloading/playing twice
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;

        await waitForVideoReady(video, 10000);
        if (cancelled) return;

        // Play once. ZXing may call play() again, but it's harmless now.
        await video.play().catch(() => void 0);
        if (cancelled) return;

        // Configure ZXing
        const hints = new Map<DecodeHintType, BarcodeFormat[] | boolean>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const callback = (
          result: Result | undefined,
          err: unknown
        ) => {
          if (result) {
            const text = result.getText();
            if (text && text !== lastTextRef.current) {
              lastTextRef.current = text;
              onScanRef.current?.(text);
              // Optionally stop after first successful scan:
              // stop();
            }
          }
          if (err instanceof Error) {
            // Ignore routine decode-cycle errors
            if (
              err.name === 'NotFoundException' ||
              err.name === 'ChecksumException' ||
              err.name === 'FormatException'
            ) {
              return;
            }
            console.error('QR Scanner error:', err);
          }
        };

        const controls = await reader.decodeFromVideoElement(
          video,
          callback
        );

        if (cancelled) {
          controls?.stop?.();
          return;
        }
        controlsRef.current = controls;
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            'Could not start video stream: ' +
              ((e as Error)?.message || String(e))
          );
          setScanning(false);
          console.error(e);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [isEnabled]);

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[360px]">
      {!isEnabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-lg">
          <p className="text-white font-medium">Scanner disabled</p>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full rounded-lg border-2 border-gray-300"
        playsInline
        muted
        autoPlay
        style={{ height: '300px', objectFit: 'cover' }}
      />

      {error && (
        <p className="text-red-500 mt-2 text-sm">{error}</p>
      )}

      <div className="mt-2 text-center">
        <p className="text-sm text-gray-600">
          {scanning
            ? 'Point camera at an Aadhaar QR code'
            : 'Scanner inactive'}
        </p>
      </div>
    </div>
  );
};

async function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 10000
): Promise<void> {
  if (video.videoWidth > 0 && video.readyState >= 2) return;

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      if (video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const onError = (e: Event) => {
      cleanup();
      reject(
        new Error(
          'Video error: ' +
            ((e as Event & { message?: string; name?: string })?.message ||
              (e as Event & { message?: string; name?: string })?.name ||
              'unknown')
        )
      );
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error('Timed out waiting for camera stream'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('error', onError);
    const timer = setTimeout(onTimeout, timeoutMs);
  });
}