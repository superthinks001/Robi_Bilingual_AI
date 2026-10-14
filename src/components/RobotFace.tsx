import React, { useEffect, useState, useRef } from 'react';
import { RobotEmotion } from '../types';

interface RobotFaceProps {
  emotion: RobotEmotion;
  mouthAmplitude: number; // 0.0 to 1.0 (from output audio meter)
  micAmplitude: number;   // 0.0 to 1.0 (from input mic meter)
  isInterrupted?: boolean;
  statusText?: string;
  isVisionActive?: boolean;
  isLookingAtCamera?: boolean;
  lastTranscript?: string;
  onFaceClick?: () => void;
  zeroTouchActive?: boolean;
}

export const RobotFace: React.FC<RobotFaceProps> = ({
  emotion,
  mouthAmplitude,
  micAmplitude,
  isInterrupted = false,
  statusText,
  isVisionActive = true,
  isLookingAtCamera = false,
  lastTranscript,
  onFaceClick,
  zeroTouchActive = true,
}) => {
  // Gaze tracking state (simulates natural eye movement and attention shifts)
  const [gazeX, setGazeX] = useState(0);
  const [gazeY, setGazeY] = useState(0);
  // Natural periodic blinking state
  const [isBlinking, setIsBlinking] = useState(false);

  // Natural organic gaze tracking and subtle micro-movements
  useEffect(() => {
    if (emotion === 'sleeping') {
      setGazeX(0);
      setGazeY(0);
      return;
    }

    if (emotion === 'thinking') {
      // Pondering gaze shifts upward and to the upper-right
      setGazeX(5);
      setGazeY(-6);
      return;
    }

    if (emotion === 'curious' || isLookingAtCamera) {
      // Looking down toward the camera feed / object on table
      setGazeX(0);
      setGazeY(6);
      return;
    }

    if (emotion === 'listening') {
      // Focused forward on user with tiny attentive adjustments
      setGazeX(0);
      setGazeY(0);
      return;
    }

    // Idle or Speaking natural gaze drift
    const interval = setInterval(() => {
      const rx = (Math.random() - 0.5) * 6;
      const ry = (Math.random() - 0.5) * 4;
      setGazeX(rx);
      setGazeY(ry);
    }, 2400);

    return () => clearInterval(interval);
  }, [emotion, isLookingAtCamera]);

  // Organic natural blinking loop
  useEffect(() => {
    if (emotion === 'sleeping') return;

    let timeoutId: any;
    const scheduleBlink = () => {
      const nextDelay = 2800 + Math.random() * 3000; // blink every 2.8 - 5.8s
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 130);
      }, nextDelay);
    };

    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, [emotion]);

  const isSleeping = emotion === 'sleeping';
  const isHappy = emotion === 'happy';
  const isListening = emotion === 'listening';
  const isThinking = emotion === 'thinking';
  const isSpeaking = emotion === 'speaking';
  const isCurious = emotion === 'curious';
  const isSurprised = emotion === 'surprised' || isInterrupted;

  // Dynamic mouth dimensions based on real-time amplitude
  const mouthOpenY = Math.max(10, Math.min(52, 10 + mouthAmplitude * 48));
  const mouthWidth = Math.max(36, Math.min(76, 40 + mouthAmplitude * 36));

  // Antenna glow color based on active cognitive state
  const antennaGlowColor = isSleeping
    ? '#475569' // slate dim
    : isListening
    ? '#38bdf8' // sky blue pulse
    : isSpeaking
    ? '#34d399' // emerald green live speech
    : isThinking
    ? '#a855f7' // purple pondering
    : isCurious
    ? '#fbbf24' // warm amber curiosity
    : isSurprised
    ? '#f43f5e' // energetic rose surprise
    : '#38bdf8'; // friendly cyan

  // Eye color theme
  const eyeColor = isCurious
    ? 'from-amber-300 via-amber-400 to-amber-500'
    : isThinking
    ? 'from-purple-300 via-purple-400 to-indigo-500'
    : isSpeaking
    ? 'from-emerald-300 via-teal-300 to-cyan-400'
    : isSurprised
    ? 'from-rose-300 via-pink-400 to-amber-400'
    : 'from-cyan-200 via-cyan-400 to-sky-500';

  const eyeGlow = isCurious
    ? 'shadow-[0_0_36px_rgba(251,191,36,0.75)]'
    : isThinking
    ? 'shadow-[0_0_36px_rgba(168,85,247,0.75)]'
    : isSpeaking
    ? 'shadow-[0_0_36px_rgba(52,211,153,0.75)]'
    : isSurprised
    ? 'shadow-[0_0_36px_rgba(244,63,94,0.75)]'
    : 'shadow-[0_0_36px_rgba(56,189,248,0.75)]';

  // Eyebrow transformations
  const leftEyebrowStyle = isSleeping
    ? 'translate-y-1 rotate-0 opacity-40'
    : isSurprised
    ? '-translate-y-3 -rotate-6 scale-110'
    : isThinking
    ? '-translate-y-2 rotate-12'
    : isCurious
    ? '-translate-y-3 -rotate-12 scale-105'
    : isListening
    ? '-translate-y-1.5 -rotate-2'
    : isSpeaking
    ? `${mouthAmplitude > 0.3 ? '-translate-y-2' : '-translate-y-1'} -rotate-3`
    : '-translate-y-0.5 -rotate-2';

  const rightEyebrowStyle = isSleeping
    ? 'translate-y-1 rotate-0 opacity-40'
    : isSurprised
    ? '-translate-y-3 rotate-6 scale-110'
    : isThinking
    ? 'translate-y-0.5 rotate-6'
    : isCurious
    ? 'translate-y-0.5 rotate-4 scale-95'
    : isListening
    ? '-translate-y-1.5 rotate-2'
    : isSpeaking
    ? `${mouthAmplitude > 0.3 ? '-translate-y-2' : '-translate-y-1'} rotate-3`
    : '-translate-y-0.5 rotate-2';

  return (
    <div
      onClick={onFaceClick}
      className="relative flex flex-col items-center justify-center w-full max-w-xl mx-auto select-none py-1 sm:py-2 transition-all duration-300"
    >
      {/* Robot Antenna / Head Horn with Live State Glow */}
      <div className="flex flex-col items-center mb-2 transition-transform duration-300">
        <div
          className="w-5 h-5 rounded-full transition-all duration-200 relative flex items-center justify-center"
          style={{
            backgroundColor: antennaGlowColor,
            boxShadow: `0 0 ${
              isSleeping
                ? 6
                : 16 + (isListening ? micAmplitude * 28 : isSpeaking ? mouthAmplitude * 32 : isThinking ? 22 : 12)
            }px ${antennaGlowColor}`,
            transform: isSpeaking
              ? `scale(${1 + mouthAmplitude * 0.35})`
              : isListening
              ? `scale(${1 + micAmplitude * 0.28})`
              : isThinking
              ? 'scale(1.15)'
              : 'scale(1)',
          }}
        >
          {/* Subtle interior light core */}
          <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_4px_white]" />
        </div>
        <div className="w-1.5 h-3 bg-slate-700/80 rounded-sm" />
      </div>

      {/* Floating Thinking Indicators when Robi is processing thought */}
      {isThinking && (
        <div className="absolute top-0 right-1/4 flex items-center gap-1.5 bg-purple-950/80 border border-purple-500/50 px-2.5 py-1 rounded-full shadow-lg backdrop-blur-sm animate-pulse z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-purple-300 tracking-wide">THINKING...</span>
        </div>
      )}

      {/* Center Stage: Eyebrows, Expressive Eyes & Cheeks (Pure face elements without box frame) */}
      <div className="flex flex-col items-center justify-center my-1 relative w-full max-w-md py-2">
        
        {/* Expressive Digital Eyebrows */}
        <div className="flex items-center justify-between w-64 sm:w-72 px-4 mb-1 pointer-events-none">
          {/* Left Eyebrow */}
          <div
            className={`w-12 sm:w-14 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.6)] transition-all duration-200 ${leftEyebrowStyle}`}
          />
          {/* Right Eyebrow */}
          <div
            className={`w-12 sm:w-14 h-1.5 rounded-full bg-gradient-to-l from-cyan-400 to-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.6)] transition-all duration-200 ${rightEyebrowStyle}`}
          />
        </div>

        {/* Eyes Row with Rosy Cheeks */}
        <div className="flex items-center justify-center gap-12 sm:gap-20 relative w-full">
          
          {/* Left Rosy Cheek Blush */}
          <div
            className={`absolute left-4 sm:left-8 bottom-0 w-10 sm:w-14 h-4 sm:h-5 rounded-full bg-rose-500/40 blur-[4px] transition-all duration-300 ${
              isSleeping
                ? 'opacity-0 scale-75'
                : isHappy || isSpeaking
                ? 'opacity-100 scale-110'
                : 'opacity-35 scale-90'
            }`}
          />

          {/* Left Eye */}
          <div className="relative">
            {isSleeping ? (
              // Peaceful Sleeping Eye Arc
              <svg className="w-16 sm:w-20 h-10 sm:h-12 text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)] animate-pulse" viewBox="0 0 60 30">
                <path
                  d="M 8 10 Q 30 26 52 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              // Living Organic Expressive Digital Eye
              <div
                className={`relative w-16 sm:w-20 h-20 sm:h-24 bg-gradient-to-b ${eyeColor} rounded-full flex items-center justify-center ${eyeGlow} transition-all duration-150 overflow-hidden`}
                style={{
                  transform: `scaleY(${isBlinking ? 0.08 : 1}) ${
                    isListening
                      ? `scale(${1 + micAmplitude * 0.16})`
                      : isCurious
                      ? 'scale(1.1) rotate(-4deg)'
                      : isSurprised
                      ? 'scale(1.18)'
                      : isSpeaking
                      ? `scale(${1 + mouthAmplitude * 0.08})`
                      : 'scale(1)'
                  }`,
                }}
              >
                {/* Cheerful Smiling Eye Taper Overlay (Soft crescent curve on happy state) */}
                {isHappy && (
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-slate-950/40 rounded-t-full transition-all duration-200" />
                )}

                {/* Pupil & Reactive Catchlight */}
                <div
                  className="w-7 sm:w-9 h-9 sm:h-11 bg-slate-950 rounded-full flex flex-col justify-start items-start p-1 transition-all duration-150"
                  style={{
                    transform: isThinking
                      ? 'translate(4px, -6px)'
                      : isCurious || isLookingAtCamera
                      ? 'translate(0px, 4px) scale(1.05)'
                      : isSurprised
                      ? 'translate(0, 0) scale(1.25)'
                      : isListening
                      ? `translate(0, 0) scale(${1 + micAmplitude * 0.3})`
                      : `translate(${gazeX}px, ${gazeY}px)`,
                  }}
                >
                  {/* Primary Catchlight / Sparkle */}
                  <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_6px_white]" />
                  {/* Secondary subtle catchlight */}
                  <div className="w-1.5 h-1.5 bg-white/80 rounded-full mt-1 ml-2" />
                </div>
              </div>
            )}
          </div>

          {/* Right Eye */}
          <div className="relative">
            {isSleeping ? (
              // Peaceful Sleeping Eye Arc
              <svg className="w-16 sm:w-20 h-10 sm:h-12 text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)] animate-pulse" viewBox="0 0 60 30">
                <path
                  d="M 8 10 Q 30 26 52 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              // Living Organic Expressive Digital Eye
              <div
                className={`relative w-16 sm:w-20 h-20 sm:h-24 bg-gradient-to-b ${eyeColor} rounded-full flex items-center justify-center ${eyeGlow} transition-all duration-150 overflow-hidden`}
                style={{
                  transform: `scaleY(${isBlinking ? 0.08 : 1}) ${
                    isListening
                      ? `scale(${1 + micAmplitude * 0.16})`
                      : isCurious
                      ? 'scale(1.02) rotate(4deg)'
                      : isSurprised
                      ? 'scale(1.18)'
                      : isSpeaking
                      ? `scale(${1 + mouthAmplitude * 0.08})`
                      : 'scale(1)'
                  }`,
                }}
              >
                {/* Cheerful Smiling Eye Taper Overlay (Soft crescent curve on happy state) */}
                {isHappy && (
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-slate-950/40 rounded-t-full transition-all duration-200" />
                )}

                {/* Pupil & Reactive Catchlight */}
                <div
                  className="w-7 sm:w-9 h-9 sm:h-11 bg-slate-950 rounded-full flex flex-col justify-start items-start p-1 transition-all duration-150"
                  style={{
                    transform: isThinking
                      ? 'translate(4px, -6px)'
                      : isCurious || isLookingAtCamera
                      ? 'translate(0px, 4px) scale(1.05)'
                      : isSurprised
                      ? 'translate(0, 0) scale(1.25)'
                      : isListening
                      ? `translate(0, 0) scale(${1 + micAmplitude * 0.3})`
                      : `translate(${gazeX}px, ${gazeY}px)`,
                  }}
                >
                  {/* Primary Catchlight / Sparkle */}
                  <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_6px_white]" />
                  {/* Secondary subtle catchlight */}
                  <div className="w-1.5 h-1.5 bg-white/80 rounded-full mt-1 ml-2" />
                </div>
              </div>
            )}
          </div>

          {/* Right Rosy Cheek Blush */}
          <div
            className={`absolute right-4 sm:right-8 bottom-0 w-10 sm:w-14 h-4 sm:h-5 rounded-full bg-rose-500/40 blur-[4px] transition-all duration-300 ${
              isSleeping
                ? 'opacity-0 scale-75'
                : isHappy || isSpeaking
                ? 'opacity-100 scale-110'
                : 'opacity-35 scale-90'
            }`}
          />
        </div>

      </div>

      {/* Robot Reactive Mouth Area */}
      <div className="w-full flex items-center justify-center h-12 relative mt-1">
        {isSleeping ? (
          // Soft sleeping quiet smile
          <svg className="w-12 h-4 text-slate-500" viewBox="0 0 48 16">
            <path
              d="M 12 5 Q 24 14 36 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        ) : isSpeaking ? (
          // Real-Time Audio-Synced Lip Moving Mouth with Inner Depth
          <div
            className="bg-gradient-to-b from-cyan-200 via-cyan-400 to-cyan-500 border border-cyan-100 rounded-full transition-all duration-75 shadow-[0_0_24px_rgba(34,211,238,0.9)] flex items-center justify-center overflow-hidden"
            style={{
              width: `${mouthWidth}px`,
              height: `${mouthOpenY}px`,
            }}
          >
            {/* Inner mouth oral cavity glow when open */}
            {mouthOpenY > 20 && (
              <div
                className="w-4/5 bg-slate-950/50 rounded-full transition-all duration-75 flex items-center justify-center"
                style={{ height: `${mouthOpenY * 0.55}px` }}
              >
                <div className="w-1/2 h-1 bg-rose-400/70 rounded-full" />
              </div>
            )}
          </div>
        ) : isListening ? (
          // Active listening mouth: soft circle that pulses with the child's microphone audio
          <div
            className="w-5 h-5 rounded-full border-2 border-sky-400 bg-sky-950/70 transition-transform duration-100 shadow-[0_0_14px_rgba(56,189,248,0.8)] flex items-center justify-center"
            style={{ transform: `scale(${1 + micAmplitude * 0.85})` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          </div>
        ) : isThinking ? (
          // Thinking undulating dots
          <div className="flex gap-2 items-center bg-slate-900/60 px-3 py-1.5 rounded-full border border-purple-500/30">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms] shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms] shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          </div>
        ) : isCurious ? (
          // Inquisitive rounded curve
          <div className="w-7 h-5 rounded-full border-2 border-amber-300 bg-amber-950/50 shadow-[0_0_14px_rgba(251,191,36,0.8)] flex items-center justify-center">
            <div className="w-2 h-1 bg-amber-200/80 rounded-full" />
          </div>
        ) : isSurprised ? (
          // Wide open surprised mouth
          <div className="w-8 h-8 rounded-full border-2 border-rose-400 bg-rose-950/60 shadow-[0_0_16px_rgba(244,63,94,0.8)] flex items-center justify-center animate-bounce">
            <div className="w-3 h-3 bg-rose-300/80 rounded-full" />
          </div>
        ) : (
          // Happy / Idle warm radiant smile curve
          <svg className="w-20 h-7 text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,0.85)]" viewBox="0 0 64 24">
            <path
              d="M 12 7 Q 32 23 52 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Audio Equalizer Waveform Bars (shown when awake) */}
      {!isSleeping && (
        <div className="w-full flex items-center justify-center gap-1.5 h-3 mt-1.5">
          {[0.25, 0.5, 0.8, 1.0, 0.8, 0.5, 0.25].map((factor, i) => {
            const activeAmp = isSpeaking ? mouthAmplitude : isListening ? micAmplitude : 0.04;
            const h = Math.max(3, Math.min(15, activeAmp * factor * 24));
            return (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: `${h}px`,
                  backgroundColor: isSpeaking
                    ? '#34d399'
                    : isListening
                    ? '#38bdf8'
                    : isThinking
                    ? '#c084fc'
                    : '#334155',
                  boxShadow: isSpeaking || isListening ? `0 0 6px currentColor` : 'none',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Floating Subtitle / Voice Caption for Child/Parent readability */}
      {lastTranscript && !isSleeping && (
        <div className="mt-2.5 max-w-md w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md transition-all duration-200 animate-fade-in text-center">
          <p className="text-sm sm:text-base font-medium text-slate-100 leading-snug">
            "{lastTranscript}"
          </p>
        </div>
      )}
    </div>
  );
};
