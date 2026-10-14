import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';

interface CameraFeedProps {
  onCaptureFrame: (base64Jpeg: string) => void;
  isStreamingVideo: boolean;
  onToggleStreamingVideo: (enabled: boolean) => void;
  detectedObjectCount?: number;
  highlightText?: string;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  onCaptureFrame,
  isStreamingVideo,
  onToggleStreamingVideo,
  detectedObjectCount,
  highlightText,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      setPermissionError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setPermissionError(err.message || 'Camera permission denied or camera not found');
      setCameraActive(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Capture frame as JPEG Base64
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 360;

    // Flip horizontally if front-facing user camera for mirror feel
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Flash visual feedback
    setFlashTrigger(true);
    setTimeout(() => setFlashTrigger(false), 250);

    // Export 75% quality JPEG
    const base64Jpeg = canvas.toDataURL('image/jpeg', 0.75);
    onCaptureFrame(base64Jpeg);
  }, [cameraActive, facingMode, onCaptureFrame]);

  // Automated interval capture if live video streaming is active
  useEffect(() => {
    if (!isStreamingVideo || !cameraActive) return;
    const interval = setInterval(() => {
      captureFrame();
    }, 1800); // 1 frame every 1.8 seconds (keeps token consumption within reasonable bounds)
    return () => clearInterval(interval);
  }, [isStreamingVideo, cameraActive, captureFrame]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const togglePrivacyCover = () => {
    if (cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => (t.enabled = !t.enabled));
      }
      setCameraActive((prev) => !prev);
    } else {
      startCamera();
    }
  };

  return (
    <div className="relative w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/70 backdrop-blur-md border-b border-slate-800 z-10 text-xs">
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-200">Robot Vision</span>
          {isStreamingVideo && (
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              LIVE STREAMING
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleFacingMode}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Switch between Rear & Front Camera"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={togglePrivacyCover}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title={cameraActive ? 'Cover Camera' : 'Uncover Camera'}
          >
            {cameraActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Camera Video Viewport */}
      <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        {permissionError ? (
          <div className="p-6 text-center text-slate-400 text-xs max-w-xs">
            <p className="font-medium text-slate-300 mb-1">Camera Inactive</p>
            <p className="mb-3 text-slate-500">{permissionError}</p>
            <button
              onClick={startCamera}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Retry Camera
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-100' : 'opacity-10'
              } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Shutter flash effect */}
            {flashTrigger && (
              <div className="absolute inset-0 bg-white/40 pointer-events-none transition-opacity duration-200" />
            )}

            {/* Target Reticle / Visual Focus Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-44 h-44 sm:w-56 sm:h-56 border-2 border-dashed border-cyan-400/40 rounded-3xl flex items-center justify-center animate-pulse">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400 absolute top-2 left-2" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400 absolute top-2 right-2" />
                  <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400 absolute bottom-2 left-2" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400 absolute bottom-2 right-2" />
                  <span className="text-[10px] text-cyan-300/80 font-mono tracking-wider bg-slate-950/60 px-2 py-0.5 rounded-full">
                    Hold items here to count
                  </span>
                </div>
              </div>
            )}

            {/* Detected context badge */}
            {highlightText && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-xl text-xs text-slate-200 flex items-center justify-between shadow-lg">
                <span className="flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{highlightText}</span>
                </span>
                {detectedObjectCount !== undefined && (
                  <span className="px-2 py-0.5 bg-cyan-900/60 text-cyan-300 rounded font-mono font-bold text-[11px] shrink-0 ml-2">
                    Count: {detectedObjectCount}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Action Strip */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={captureFrame}
          disabled={!cameraActive}
          className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-900/20"
        >
          <Camera className="w-4 h-4" />
          <span>Show to Robot</span>
        </button>

        <button
          onClick={() => onToggleStreamingVideo(!isStreamingVideo)}
          className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isStreamingVideo
              ? 'bg-amber-600/90 hover:bg-amber-500 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {isStreamingVideo ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Live On</span>
            </>
          ) : (
            <span>Enable Live Feed</span>
          )}
        </button>
      </div>
    </div>
  );
};
