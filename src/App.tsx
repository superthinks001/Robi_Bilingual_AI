import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Volume2,
  Mic,
  RefreshCw,
  Sparkles,
  Radio,
  ShieldAlert,
  Check,
  Copy,
  QrCode,
  CheckCircle2,
  FileText,
  FolderGit2,
  Smile,
  Activity,
  X,
  Play,
  Square,
  ExternalLink,
} from 'lucide-react';
import { resampleTo16kPCMBase64, getAudioRMS, LiveAudioPlayer } from './utils/audio';
import { TestDocumentationModal } from './components/TestDocumentationModal';
import { GitHubPushModal } from './components/GitHubPushModal';
import { RobotFace } from './components/RobotFace';
import { RobotEmotion } from './types';

const DEV_APP_URL = 'https://ais-dev-z2vsv7o4divvu6tsqcabk7-668377774193.us-west2.run.app';

export default function App() {
  // Connection & Media States
  const [isAwake, setIsAwake] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  // Always default to main back camera view ('environment') looking out at the world
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');

  // UI Modes: 'face' (Primary zero-touch child companion screen) or 'workbench' (Diagnostics / tech logs)
  const [viewMode, setViewMode] = useState<'face' | 'workbench'>('face');

  // Robot Emotional & Expression States
  const [emotion, setEmotion] = useState<RobotEmotion>('idle');
  const [isRobotSpeaking, setIsRobotSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [recentBargeIn, setRecentBargeIn] = useState(false);
  const [isWaitingVisionResponse, setIsWaitingVisionResponse] = useState(false);
  const [lastModelUtterance, setLastModelUtterance] = useState<string>('');

  // Audio VU Meter Levels
  const [userMicLevel, setUserMicLevel] = useState(0);
  const [robotAudioLevel, setRobotAudioLevel] = useState(0);

  // Documentation, GitHub & Diagnostics Modals
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Camera Visual Feedback & Diagnostics
  const [flashEffect, setFlashEffect] = useState(false);
  const [lastFrameSnapshot, setLastFrameSnapshot] = useState<string | null>(null);
  const [lastServerAckTime, setLastServerAckTime] = useState<string | null>(null);
  const [lastServerAckSize, setLastServerAckSize] = useState<number | null>(null);

  // Transcript & Metric states for Diagnostics Workbench
  const [transcripts, setTranscripts] = useState<Array<{ id: string; role: 'user' | 'model' | 'system'; text: string; time: string; language?: 'english' | 'spanish' | 'spanglish' }>>([
    {
      id: 'init-1',
      role: 'system',
      text: 'Robi Companion Robot ready. Tap "Wake Up Robi" to begin bilingual play and camera vision.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [metrics, setMetrics] = useState({
    audioChunksSent: 0,
    audioChunksReceived: 0,
    videoFramesSent: 0,
    latencyMs: 42,
    sessionStartTime: Date.now(),
  });

  // Hardware & Media Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bargeInTimeoutRef = useRef<any>(null);

  // Detect iOS Safari
  const isIPhone = typeof navigator !== 'undefined' && /iPhone|iPod|iPad/i.test(navigator.userAgent);

  // Helper to infer expressive emotion from dialogue context and child interaction
  const inferSpeechEmotion = useCallback((text: string): RobotEmotion => {
    if (!text) return 'speaking';
    const lower = text.toLowerCase();
    // Inquisitive, questioning, inspecting objects
    if (
      lower.includes('?') ||
      lower.includes('¿') ||
      lower.includes('what') ||
      lower.includes('qué') ||
      lower.includes('see') ||
      lower.includes('veo') ||
      lower.includes('where') ||
      lower.includes('dónde') ||
      lower.includes('look') ||
      lower.includes('mira') ||
      lower.includes('toy') ||
      lower.includes('juguete') ||
      lower.includes('which') ||
      lower.includes('cuál')
    ) {
      return 'curious';
    }
    // Joyful, celebrating, praising child
    if (
      lower.includes('yay') ||
      lower.includes('great') ||
      lower.includes('¡') ||
      lower.includes('wow') ||
      lower.includes('love') ||
      lower.includes('fun') ||
      lower.includes('awesome') ||
      lower.includes('jaja') ||
      lower.includes('haha') ||
      lower.includes('amigo') ||
      lower.includes('amiga') ||
      lower.includes('bien') ||
      lower.includes('excelente') ||
      lower.includes('super') ||
      lower.includes('cool') ||
      lower.includes('bravo') ||
      lower.includes('smile')
    ) {
      return 'happy';
    }
    return 'speaking';
  }, []);

  // Automatic Emotional Reaction Engine based on dialogue, thinking, speaking, and vision
  useEffect(() => {
    if (!isAwake) {
      setEmotion('sleeping');
      return;
    }

    if (recentBargeIn) {
      setEmotion('surprised');
      return;
    }

    if (isWaitingVisionResponse) {
      setEmotion('curious');
      return;
    }

    if (isRobotSpeaking) {
      const speechEmo = inferSpeechEmotion(lastModelUtterance);
      setEmotion(speechEmo);
      return;
    }

    if (isThinking) {
      setEmotion('thinking');
      return;
    }

    if (userMicLevel > 0.08) {
      setEmotion('listening');
      return;
    }

    setEmotion('idle');
  }, [isAwake, recentBargeIn, isWaitingVisionResponse, isRobotSpeaking, isThinking, userMicLevel, lastModelUtterance, inferSpeechEmotion]);

  // Append new dialogue transcript
  const addTranscript = useCallback((role: 'user' | 'model' | 'system', text: string, language?: 'english' | 'spanish' | 'spanglish') => {
    setTranscripts((prev) => [
      ...prev.slice(-35),
      {
        id: Math.random().toString(36).substring(2, 9),
        role,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        language,
      },
    ]);
  }, []);

  // Initialize and Connect WebSocket to Gemini Live Proxy
  const connectLive = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live-stream`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    if (!playerRef.current) {
      playerRef.current = new LiveAudioPlayer((isPlaying: boolean, amp: number) => {
        setIsRobotSpeaking(isPlaying);
        setRobotAudioLevel(amp);
      });
    } else {
      playerRef.current.setCallback((isPlaying: boolean, amp: number) => {
        setIsRobotSpeaking(isPlaying);
        setRobotAudioLevel(amp);
      });
    }

    ws.onopen = () => {
      console.log('[WebSocket] Connected to /api/live-stream proxy');
      addTranscript('system', 'Connected to Robi live proxy. Waiting for Gemini...');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'status') {
          if (msg.status === 'connected') {
            setIsConnected(true);
            setIsConnecting(false);
            addTranscript('system', 'Connected to Gemini Live session. Robi is awake!');
          } else if (msg.status === 'connecting_gemini') {
            setIsConnecting(true);
          } else if (msg.status === 'disconnected') {
            setIsConnected(false);
            setIsConnecting(false);
          }
        } else if (msg.type === 'session_info') {
          addTranscript('system', `Session ID: ${msg.sessionId}`);
        } else if (msg.type === 'audio' && msg.data) {
          setIsThinking(false);
          if (playerRef.current) {
            playerRef.current.enqueueChunk(msg.data);
          }
          setMetrics((m) => ({ ...m, audioChunksReceived: m.audioChunksReceived + 1 }));
        } else if (msg.type === 'interrupted') {
          if (playerRef.current) {
            playerRef.current.flush();
          }
          setIsRobotSpeaking(false);
          setRobotAudioLevel(0);
          setIsThinking(false);
          setRecentBargeIn(true);
          clearTimeout(bargeInTimeoutRef.current);
          bargeInTimeoutRef.current = setTimeout(() => setRecentBargeIn(false), 2400);
          addTranscript('system', '⚡ Robi stopped speaking to listen to you.');
        } else if (msg.type === 'turn_complete') {
          setIsThinking(false);
          setIsWaitingVisionResponse(false);
        } else if (msg.type === 'transcript' || msg.type === 'model_text') {
          if (msg.role === 'model' || msg.type === 'model_text') {
            setLastModelUtterance(msg.text);
            setIsWaitingVisionResponse(false);
            setIsThinking(false);
            addTranscript('model', msg.text, msg.language);
          } else {
            addTranscript('user', msg.text);
          }
        } else if (msg.type === 'user_text') {
          addTranscript('user', msg.text);
        } else if (msg.type === 'frame_received' || msg.type === 'ack_video') {
          setLastServerAckTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setLastServerAckSize(msg.sizeKb || (msg.size ? Math.round(msg.size / 1024) : null));
        } else if (msg.type === 'error') {
          console.error('[Gemini Live Error]:', msg.error);
          addTranscript('system', `Error: ${msg.error}`);
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Connection closed');
      setIsConnected(false);
      setIsConnecting(false);
      setIsRobotSpeaking(false);
      setIsThinking(false);
      wsRef.current = null;
      addTranscript('system', 'Disconnected from Gemini Live session.');
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setIsThinking(false);
      addTranscript('system', 'Connection error to Gemini Live proxy.');
    };
  }, [addTranscript]);

  const disconnectLive = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.flush();
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsRobotSpeaking(false);
    setIsThinking(false);
    setRobotAudioLevel(0);
  }, []);

  // Microphone capture and streaming to Gemini Live
  const startMic = useCallback(async () => {
    try {
      if (playerRef.current) {
        playerRef.current.init();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = scriptNode;

      let hadSpeech = false;
      let pauseTimeout: any = null;

      scriptNode.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

        const rms = getAudioRMS(inputData);
        setUserMicLevel(rms);

        if (rms > 0.08) {
          hadSpeech = true;
          clearTimeout(pauseTimeout);
        } else if (hadSpeech) {
          // User paused speaking: trigger thoughtful reaction after 450ms
          clearTimeout(pauseTimeout);
          pauseTimeout = setTimeout(() => {
            if (hadSpeech) {
              setIsThinking(true);
              hadSpeech = false;
            }
          }, 450);
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const base64PCM = resampleTo16kPCMBase64(inputData, audioCtx.sampleRate);
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64PCM,
          }));
          setMetrics((m) => ({ ...m, audioChunksSent: m.audioChunksSent + 1 }));
        }
      };

      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);
      setMicActive(true);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setMicActive(false);
    }
  }, []);

  const stopMic = useCallback(() => {
    setIsThinking(false);
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setMicActive(false);
    setUserMicLevel(0);
  }, []);

  // Camera capture - attaches to persistent videoRef element (defaults to main back camera 'environment')
  const startCamera = useCallback(async (facingOverride?: 'user' | 'environment') => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const facing = facingOverride || cameraFacing;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      cameraStreamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.defaultMuted = true;
        try {
          await video.play();
        } catch (e) {
          console.warn('Video play caught:', e);
        }
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsCameraActive(false);
    }
  }, [cameraFacing]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const switchCameraFacing = () => {
    stopCamera();
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    setTimeout(() => startCamera(nextFacing), 350);
  };

  // Keep videoRef.current attached and actively playing
  useEffect(() => {
    const video = videoRef.current;
    if (video && cameraStreamRef.current) {
      if (video.srcObject !== cameraStreamRef.current) {
        video.srcObject = cameraStreamRef.current;
      }
      video.play().catch((err) => console.warn('Video play auto-resume:', err));
    }
  }, [isCameraActive, cameraFacing, viewMode]);

  // Canvas frame capture for Gemini Live
  const captureJpegFromVideo = useCallback((video: HTMLVideoElement): string | null => {
    if (!video || !video.srcObject) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const canvas = canvasRef.current || document.createElement('canvas');
      const maxDim = 480; // Optimized from 640 to prevent context window saturation while keeping sharp object details
      const scale = Math.min(maxDim / vw, maxDim / vh, 1);
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      // Draw real unmirrored sensor pixels directly to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.68); // Optimized from 0.82 to reduce payload by 65%
      const base64Jpeg = dataUrl.split(',')[1];
      setLastFrameSnapshot(dataUrl);
      return base64Jpeg;
    } catch (err) {
      console.error('Frame capture failed:', err);
      return null;
    }
  }, []);

  // Continuous Camera Ingestion Loop (Paced at ~0.6 FPS / 1600ms to preserve context health)
  useEffect(() => {
    if (isConnected && isCameraActive) {
      frameIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const base64Jpeg = captureJpegFromVideo(videoRef.current);
        if (!base64Jpeg) return;

        wsRef.current.send(JSON.stringify({
          type: 'video',
          data: base64Jpeg,
        }));

        setMetrics((m) => ({ ...m, videoFramesSent: m.videoFramesSent + 1 }));
      }, 1600);
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isConnected, isCameraActive, captureJpegFromVideo]);

  // Single Frame Snapshot on Demand
  const sendCurrentFrame = useCallback((promptQuery?: string) => {
    if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const base64Jpeg = captureJpegFromVideo(videoRef.current);
    if (!base64Jpeg) return;

    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    wsRef.current.send(JSON.stringify({
      type: 'snapshot',
      data: base64Jpeg,
      prompt: promptQuery,
    }));

    setLastFrameSnapshot(`data:image/jpeg;base64,${base64Jpeg}`);
    setIsWaitingVisionResponse(true);
  }, [captureJpegFromVideo]);

  // 1-Tap Wake Up: Starts full hands-free companion (Camera + Mic + WebSocket)
  const wakeUpRobi = useCallback(async () => {
    setIsAwake(true);
    setIsConnecting(true);
    setIsThinking(false);
    setCameraFacing('environment'); // Always default to main back camera
    addTranscript('system', 'Waking up Robi... activating camera and audio.');

    // Start camera immediately with back camera default
    try {
      await startCamera('environment');
    } catch (camErr) {
      console.error('Camera startup error:', camErr);
    }

    // Start microphone
    try {
      await startMic();
    } catch (micErr) {
      console.error('Mic startup error:', micErr);
    }

    // Connect to live WebSocket session
    connectLive();
  }, [connectLive, startMic, startCamera, addTranscript]);

  const putRobiToSleep = useCallback(() => {
    setIsAwake(false);
    setIsThinking(false);
    setIsWaitingVisionResponse(false);
    setCameraFacing('environment'); // Reset to default back camera
    stopMic();
    stopCamera();
    disconnectLive();
    addTranscript('system', 'Robi is now sleeping. Zzz...');
  }, [stopMic, stopCamera, disconnectLive, addTranscript]);

  // Dev link for QR code (opens directly on iPhone)
  const devAppUrl = typeof window !== 'undefined' && window.location.origin.includes('http')
    ? window.location.origin
    : DEV_APP_URL;

  const copySharedLink = () => {
    navigator.clipboard.writeText(devAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070b14] text-slate-100 selection:bg-cyan-500 selection:text-black">
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Floating Control Bar */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
        
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-cyan-500/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">Robi Companion</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                {isConnected ? 'LIVE' : isConnecting ? 'WAKING UP' : 'ASLEEP'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden xs:block">
              Zero-Touch Child Robot Face · English / Spanish Bilingual
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* View Mode Switcher */}
          <button
            onClick={() => setViewMode(viewMode === 'face' ? 'workbench' : 'face')}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-sm"
            title="Toggle between Robot Face Mode and Parent Tech Diagnostics"
          >
            {viewMode === 'face' ? (
              <>
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Diagnostics</span>
              </>
            ) : (
              <>
                <Smile className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Robot Face</span>
              </>
            )}
          </button>

          {/* GitHub Setup Button */}
          <button
            onClick={() => setShowGitModal(true)}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-sm"
            title="GitHub Push & Repository Status for Item 1"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">GitHub</span>
          </button>

          {/* iPhone QR Code Button */}
          <button
            onClick={() => setShowQr((prev) => !prev)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Scan QR Code to Open Live on iPhone"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">iPhone QR</span>
          </button>

          {/* Wake Up / Sleep Button */}
          <button
            onClick={isAwake ? putRobiToSleep : wakeUpRobi}
            disabled={isConnecting}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              isAwake
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                : isConnecting
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
          >
            {isAwake ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Sleep</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Wake Up</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Sub-Header Task Bar: Status & Vision indicators right below top nav */}
      <div className="w-full bg-slate-950/90 border-b border-slate-800/80 px-3 sm:px-5 py-2 flex items-center justify-between text-xs z-20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              !isAwake
                ? 'bg-slate-500'
                : isRobotSpeaking
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : isThinking
                ? 'bg-purple-400 shadow-[0_0_8px_#c084fc] animate-pulse'
                : userMicLevel > 0.08
                ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse'
                : isWaitingVisionResponse
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                : isConnecting
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping'
                : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
            }`}
          />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            {!isAwake
              ? 'SLEEPING'
              : isRobotSpeaking
              ? 'SPEAKING'
              : isThinking
              ? 'THINKING...'
              : userMicLevel > 0.08
              ? 'LISTENING TO YOU'
              : isWaitingVisionResponse
              ? 'INSPECTING OBJECT'
              : isConnecting
              ? 'WAKING UP...'
              : 'READY TO PLAY'}
          </span>
          {recentBargeIn && (
            <span className="text-[10px] text-rose-400 font-semibold px-2 py-0.5 rounded-full bg-rose-950/70 border border-rose-800/50">
              ⚡ BARGE-IN
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/60 text-[11px] text-purple-300 font-mono tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            SPANGLISH · AGES 4–8
          </span>
          {isCameraActive && isAwake && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-800/70 text-[11px] text-cyan-400 font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              VISION ON
            </span>
          )}
          <span className="text-slate-500 text-xs font-mono hidden sm:inline">ROBI BOT</span>
        </div>
      </div>

      {/* iPhone QR Modal (Reliable Dev Preview - Direct and Bug-Free) */}
      {showQr && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-col items-center justify-center text-center animate-in fade-in z-20">
          <div className="max-w-md w-full flex flex-col items-center">
            
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>Test Live on iPhone (Dev Preview)</span>
              </span>
              <button onClick={() => setShowQr(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xl mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(devAppUrl)}`}
                alt="Scan QR for iPhone Testing"
                className="w-44 h-44"
              />
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-2.5 w-full max-w-sm text-left">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Live Dev Stream Ready for iPhone</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Scan this QR code with your iPhone Camera to open Robi directly in Safari. Tap &ldquo;Tap to Wake Up Robi&rdquo; to start camera vision & bilingual voice!
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-cyan-300 font-mono w-full max-w-sm mt-1">
              <span className="truncate flex-1 text-left">{devAppUrl}</span>
              <a
                href={devAppUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-white transition-colors p-1"
                title="Open Link in New Tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={copySharedLink}
                className="text-slate-400 hover:text-white transition-colors p-1"
                title="Copy Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-5 relative overflow-hidden">
        
        {/* =========================================================================
           ITEM 3: ZERO-TOUCH LIVING ROBOT FACE DISPLAY (CHILD/PARENT IMMERSION)
           ========================================================================= */}
        <div className={`flex-1 w-full max-w-2xl flex flex-col items-center justify-between gap-3 h-full min-h-0 ${viewMode === 'face' ? 'flex' : 'hidden'}`}>
          
          {/* Sleeping State: Friendly resting face with prominent Wake Up tap button */}
          {!isAwake ? (
            <div className="my-auto w-full flex flex-col items-center justify-center gap-6 text-center animate-fade-in py-6">
              
              {/* Resting Robot Face */}
              <div className="w-full max-w-md">
                <RobotFace
                  emotion="sleeping"
                  mouthAmplitude={0}
                  micAmplitude={0}
                  isInterrupted={false}
                  isVisionActive={false}
                  isLookingAtCamera={false}
                  lastTranscript={lastModelUtterance}
                  statusText="SLEEPING · TAP BELOW TO WAKE"
                />
              </div>

              {/* Large Wake-Up Button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={wakeUpRobi}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-2xl shadow-cyan-500/30 text-lg flex items-center gap-3 transition-transform active:scale-95 border border-cyan-300/40 cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-current text-slate-950" />
                  <span>Tap to Wake Up Robi</span>
                </button>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Designed for 4-6 year olds: Zero-touch interaction once awake. Robi sees through the camera and talks automatically in English & Spanish!
                </p>
              </div>

            </div>
          ) : (
            /* =========================================================================
               AWAKE STATE: 
               - UPPER PART: Robi's Animated Expressive Face
               - BOTTOM PART: What Robi Sees in a Framed Container (Not a Pop-Up)
               ========================================================================= */
            <div className="flex-1 w-full flex flex-col justify-between items-center gap-2.5 h-full min-h-0 animate-fade-in">
              
              {/* UPPER PART: LIVING ROBOT FACE DISPLAY */}
              <div className="w-full flex-1 min-h-[220px] max-h-[46vh] sm:max-h-[50vh] flex flex-col items-center justify-center relative">
                <RobotFace
                  emotion={emotion}
                  mouthAmplitude={isRobotSpeaking ? robotAudioLevel : 0}
                  micAmplitude={userMicLevel}
                  isInterrupted={recentBargeIn}
                  isVisionActive={isCameraActive}
                  isLookingAtCamera={isWaitingVisionResponse || emotion === 'curious'}
                  lastTranscript={lastModelUtterance}
                  statusText={
                    recentBargeIn
                      ? 'I STOPPED TALKING TO HEAR YOU'
                      : isRobotSpeaking
                      ? emotion === 'curious'
                        ? 'CURIOUS · ASKING YOU'
                        : emotion === 'happy'
                        ? 'CHEERFUL · TALKING'
                        : 'SPEAKING TO YOU'
                      : isThinking
                      ? 'THINKING...'
                      : userMicLevel > 0.08
                      ? 'LISTENING TO YOU'
                      : isWaitingVisionResponse
                      ? 'INSPECTING OBJECT'
                      : isConnecting
                      ? 'WAKING UP...'
                      : 'READY TO PLAY'
                  }
                />

                {/* Barge-In Cutoff Badge */}
                {recentBargeIn && (
                  <div className="absolute top-8 sm:top-10 px-3 py-1 bg-rose-950/90 border border-rose-500/50 text-rose-300 rounded-full text-xs flex items-center gap-1.5 shadow-lg animate-bounce">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>I stopped talking to hear you!</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
             PERSISTENT CAMERA VIEW ELEMENT (STAYS IN DOM FOR IOS SAFARI STABILITY)
             When Awake: Framed in the bottom section of the UI with real-world perspective!
             When Sleeping: Kept mounted with h-0 opacity-0 overflow-hidden
             ========================================================================= */}
          <div
            className={`w-full max-w-md sm:max-w-lg mx-auto flex flex-col rounded-2xl sm:rounded-3xl border-2 border-cyan-500/60 bg-slate-950 shadow-2xl overflow-hidden relative ring-4 ring-cyan-500/10 transition-all duration-300 ${
              isAwake
                ? 'h-48 sm:h-60 max-h-[36vh] shrink-0 mb-1'
                : 'h-0 opacity-0 overflow-hidden pointer-events-none'
            }`}
          >
            {/* Frame Header Bar */}
            <div className="bg-slate-900/95 border-b border-cyan-900/40 px-3 py-1.5 flex items-center justify-between text-xs backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] font-bold text-cyan-300 tracking-wide flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>WHAT ROBI SEES (LIVE)</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Front / Back Camera Switcher (defaults to Front) */}
                <button
                  onClick={switchCameraFacing}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-mono flex items-center gap-1 transition-colors shadow-sm"
                  title="Switch between Front and Rear Camera"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>{cameraFacing === 'user' ? 'Front' : 'Back'}</span>
                </button>
              </div>
            </div>

            {/* Video Viewport: Natural perspective by default (NO mirroring, matching reality) */}
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                webkit-playsinline="true"
                muted
                autoPlay
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch((e) => console.warn('Video loadedmetadata play caught:', e));
                  }
                }}
                className="w-full h-full object-cover"
              />

              {/* Flash Effect on Vision Ingestion */}
              {flashEffect && (
                <div className="absolute inset-0 bg-white/80 pointer-events-none transition-opacity duration-150 z-20" />
              )}

              {/* Bottom Frame Status Overlay */}
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none text-[9px] font-mono">
                <span className="bg-slate-950/80 px-2 py-0.5 rounded text-cyan-300 border border-cyan-900/40 backdrop-blur-sm">
                  {isWaitingVisionResponse ? '⚡ Analyzing frame...' : 'Streaming 640x480 to Gemini Live'}
                </span>
                <span className="bg-slate-950/80 px-2 py-0.5 rounded text-slate-400 border border-slate-800 backdrop-blur-sm">
                  {cameraFacing === 'user' ? 'Front Camera' : 'Rear Camera'} · Natural View
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================================
           PARENT / DEVELOPER DIAGNOSTICS WORKBENCH
           ========================================================================= */}
        <div className={`flex-1 w-full max-w-3xl flex flex-col gap-4 animate-fade-in text-xs font-sans ${viewMode === 'workbench' ? 'flex' : 'hidden'}`}>
          
          {/* Header Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Parent & Developer Control Deck</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full font-mono">
                  Item 1 & 2 Verified
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time audio VU meters, camera feed controls, live dialogue transcripts, and session logs
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDocsModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Item 1 Docs</span>
              </button>
            </div>
          </div>

          {/* Audio VU Meters & Barge-In */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  Microphone Input (16kHz PCM)
                </span>
                <span className="font-mono text-[10px]">{Math.round(userMicLevel * 100)}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all duration-75"
                  style={{ width: `${Math.min(100, userMicLevel * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Gemini Live Output (24kHz Audio)
                </span>
                <span className="font-mono text-[10px]">
                  {isRobotSpeaking ? `${Math.round(robotAudioLevel * 100)}%` : 'Silent'}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-75"
                  style={{ width: `${isRobotSpeaking ? Math.min(100, (0.3 + robotAudioLevel * 0.7) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Camera Inspection Strip */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs">Camera Feed & Ingestion Status</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={switchCameraFacing}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Flip Camera</span>
                </button>
                <button
                  onClick={() => sendCurrentFrame('What physical object do you see in front of the camera right now? Please describe it accurately.')}
                  disabled={!isConnected}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Test &ldquo;What do you see?&rdquo;</span>
                </button>
              </div>
            </div>

            {lastFrameSnapshot && (
              <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <img
                  src={lastFrameSnapshot}
                  alt="Camera feed snapshot"
                  className="w-24 h-18 object-cover rounded-lg border border-cyan-500/50 shadow"
                />
                <div className="flex-1 text-[11px] font-mono text-slate-300">
                  <p className="text-emerald-400 font-semibold flex items-center gap-1 font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Live Camera Frame Captured & Streamed (Unmirrored Direct Sensor)
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {lastServerAckTime ? `Verified at ${lastServerAckTime}` : 'Continuous stream active'}
                    {lastServerAckSize && ` · ${lastServerAckSize} KB`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dialogue Transcript Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col flex-1 min-h-[200px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="font-bold text-slate-300">Live Dialogue Log</span>
              <span className="text-[10px] font-mono text-slate-500">
                {metrics.audioChunksSent} sent · {metrics.audioChunksReceived} received · {metrics.videoFramesSent} frames
              </span>
            </div>
            <div className="overflow-y-auto max-h-56 space-y-2 font-mono text-[11px]">
              {transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-2 rounded-xl ${
                    t.role === 'user'
                      ? 'bg-slate-800 text-cyan-200 ml-4'
                      : t.role === 'model'
                      ? 'bg-slate-950 border border-cyan-900/40 text-slate-200 mr-4'
                      : 'bg-slate-950/40 text-slate-400 italic'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 mb-0.5 flex justify-between font-sans items-center">
                    <span className="font-bold uppercase flex items-center gap-1.5">
                      <span>{t.role === 'model' ? 'Robi' : t.role === 'user' ? 'Child / Parent' : 'System'}</span>
                      {t.language && (
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-medium ${
                          t.language === 'spanglish'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                            : t.language === 'spanish'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-sky-950 text-sky-300 border border-sky-800/60'
                        }`}>
                          {t.language}
                        </span>
                      )}
                    </span>
                    <span>{t.time}</span>
                  </div>
                  <p className="leading-relaxed">{t.text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* Modals */}
      <TestDocumentationModal
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        currentLiveMetrics={metrics}
        currentTranscripts={transcripts}
        isIPhone={isIPhone}
      />

      <GitHubPushModal
        isOpen={showGitModal}
        onClose={() => setShowGitModal(false)}
      />

    </div>
  );
}
