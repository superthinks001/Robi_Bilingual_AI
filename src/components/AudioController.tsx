import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { floatTo16BitPCMBase64, getAudioRMS, LiveAudioPlayer } from '../utils/audio';

interface AudioControllerProps {
  onAudioChunk: (base64Pcm: string) => void;
  onInterruption: () => void;
  onMicAmplitude: (amp: number) => void;
  onMouthAmplitude: (amp: number) => void;
  isRobotSpeaking: boolean;
  incomingAudioChunk: string | null;
  flushTrigger: number; // incremented whenever interruption happens
}

export const AudioController: React.FC<AudioControllerProps> = ({
  onAudioChunk,
  onInterruption,
  onMicAmplitude,
  onMouthAmplitude,
  isRobotSpeaking,
  incomingAudioChunk,
  flushTrigger,
}) => {
  const [micActive, setMicActive] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);

  // Initialize the 24kHz LiveAudioPlayer for speaker output
  useEffect(() => {
    playerRef.current = new LiveAudioPlayer((amp: number) => {
      if (!speakerMuted) {
        onMouthAmplitude(amp);
      }
    });

    return () => {
      playerRef.current?.stop();
    };
  }, [onMouthAmplitude, speakerMuted]);

  // Handle incoming 24kHz audio chunks from Gemini Live
  useEffect(() => {
    if (incomingAudioChunk && !speakerMuted) {
      playerRef.current?.enqueueChunk(incomingAudioChunk);
    }
  }, [incomingAudioChunk, speakerMuted]);

  // Handle flush trigger (barge-in interruption)
  useEffect(() => {
    if (flushTrigger > 0) {
      playerRef.current?.flush();
    }
  }, [flushTrigger]);

  // Start microphone capture at 16kHz
  const startMic = useCallback(async () => {
    try {
      setMicPermissionError(null);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      // ScriptProcessorNode with bufferSize 4096 (approx 256ms per audio chunk at 16kHz)
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const rms = getAudioRMS(inputData);
        onMicAmplitude(Math.min(1, rms * 4));

        // Local Voice Activity Detection for instant Barge-in Interruption:
        // If the robot is currently speaking and user speaks with significant energy (> 0.05),
        // instantly cut off robot audio locally (< 100ms) without waiting for server round-trip!
        if (isRobotSpeaking && rms > 0.045) {
          console.log('[Barge-In] Local interruption detected! Energy:', rms);
          playerRef.current?.flush();
          onInterruption();
        }

        // Send 16kHz PCM chunk to Gemini Live WebSocket
        const base64Chunk = floatTo16BitPCMBase64(inputData);
        onAudioChunk(base64Chunk);
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
      setMicActive(true);
    } catch (err: any) {
      console.warn('Microphone error:', err);
      setMicPermissionError(err.message || 'Microphone access denied');
      setMicActive(false);
    }
  }, [isRobotSpeaking, onAudioChunk, onInterruption, onMicAmplitude]);

  const stopMic = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    setMicActive(false);
    onMicAmplitude(0);
  }, [onMicAmplitude]);

  const toggleMic = () => {
    if (micActive) {
      stopMic();
    } else {
      startMic();
    }
  };

  const toggleSpeaker = () => {
    setSpeakerMuted((prev) => {
      const next = !prev;
      if (next) {
        playerRef.current?.flush();
        onMouthAmplitude(0);
      }
      return next;
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Mic toggle */}
      <button
        onClick={toggleMic}
        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
          micActive
            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
        title={micActive ? 'Mute Microphone' : 'Enable 16kHz Microphone for Gemini Live'}
      >
        {micActive ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
        <span>{micActive ? 'Mic Active' : 'Unmute Mic'}</span>
      </button>

      {/* Speaker Mute toggle */}
      <button
        onClick={toggleSpeaker}
        className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
          speakerMuted
            ? 'bg-amber-900/60 text-amber-300 border border-amber-500/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
        title={speakerMuted ? 'Unmute Speaker Output' : 'Mute Speaker Output'}
      >
        {speakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Manual Interruption Trigger Button */}
      {isRobotSpeaking && (
        <button
          onClick={() => {
            playerRef.current?.flush();
            onInterruption();
          }}
          className="px-3 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md animate-pulse"
          title="Simulate child interruption mid-sentence"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Interrupt Robot</span>
        </button>
      )}

      {micPermissionError && (
        <span className="text-[11px] text-rose-400 truncate max-w-xs" title={micPermissionError}>
          Mic error: {micPermissionError}
        </span>
      )}
    </div>
  );
};
