import React, { useRef, useEffect } from 'react';
import { MessageSquare, Bot, User, Volume2, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface LiveChatTranscriptProps {
  messages: ChatMessage[];
  onPlayAudioClip?: (base64Audio: string) => void;
  isStreamingVoice: boolean;
  liveModelTranscript?: string;
}

export const LiveChatTranscript: React.FC<LiveChatTranscriptProps> = ({
  messages,
  onPlayAudioClip,
  isStreamingVoice,
  liveModelTranscript,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveModelTranscript]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>Bilingual Dialogue & Math Transcript</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {messages.length} turns
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {messages.length === 0 && !liveModelTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Bot className="w-8 h-8 text-slate-600 mb-2" />
            <p className="font-medium text-slate-400">Ready for conversation</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              Say &ldquo;Hello Robi!&rdquo; or &ldquo;¡Hola Robi! Mira lo que tengo aquí&rdquo; to test real-time bilingual voice and camera counting.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isUser
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-cyan-600/90 text-white'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md ${
                  isUser
                    ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tr-sm'
                    : 'bg-slate-950/80 border border-cyan-500/30 text-slate-100 rounded-tl-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-[10px] text-slate-400 font-mono">
                  <span className="font-semibold text-slate-300">
                    {isUser ? 'Child / Parent' : 'Robi Robot'}
                  </span>
                  <span>·</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  {msg.language && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold uppercase text-[9px]">
                      {msg.language}
                    </span>
                  )}
                </div>

                <p className="leading-relaxed whitespace-pre-wrap text-[13px]">{msg.text}</p>

                {msg.detectedObjects && msg.detectedObjects.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Visual Context: {msg.detectedObjects.join(', ')}</span>
                  </div>
                )}

                {msg.audioBase64 && onPlayAudioClip && (
                  <button
                    onClick={() => onPlayAudioClip(msg.audioBase64!)}
                    className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 font-medium text-[11px] transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Replay Audio</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Live streaming preview chunk if model is currently generating */}
        {liveModelTranscript && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-cyan-600/90 text-white flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-cyan-950/40 border border-cyan-400/40 text-cyan-100 shadow-md">
              <div className="text-[10px] font-mono text-cyan-400 mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>Streaming response...</span>
              </div>
              <p className="leading-relaxed text-[13px]">{liveModelTranscript}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
