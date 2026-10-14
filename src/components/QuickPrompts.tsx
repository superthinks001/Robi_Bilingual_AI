import React from 'react';
import { Sparkles, ShieldAlert } from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  onTriggerInterruption: () => void;
  isRobotSpeaking: boolean;
}

export const QuickPrompts: React.FC<QuickPromptsProps> = ({
  onSelectPrompt,
  onTriggerInterruption,
  isRobotSpeaking,
}) => {
  const prompts = [
    {
      title: "Vision Math: Count Objects",
      text: "Look at my camera! Count how many objects I'm holding up and tell me in both English and Spanish.",
      badge: "Multimodal",
    },
    {
      title: "Bilingual Code-Switching Story",
      text: "I have dos manzanas and one banana on my desk. Can you weave a short fun math story about them?",
      badge: "Spanglish",
    },
    {
      title: "Spanish Dialogue: ¿Cuántos hay?",
      text: "¡Hola Robi! Mira lo que tengo aquí en mi mesa. ¿Puedes decirme cuántos objetos ves?",
      badge: "Español",
    },
    {
      title: "Basic Addition: 1 + 2 = 3",
      text: "If I have 1 apple and you give me 2 more peaches, how many fruits do I have altogether?",
      badge: "Early Math",
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Verification Triggers</span>
        </h3>
        {isRobotSpeaking && (
          <button
            onClick={onTriggerInterruption}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 animate-pulse"
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Test Barge-In Cutoff</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(p.text)}
            className="text-left p-2.5 rounded-2xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800/80 hover:border-cyan-500/40 transition-all group"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-semibold text-slate-200 text-xs group-hover:text-cyan-300 transition-colors">
                {p.title}
              </span>
              <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/70 px-1.5 py-0.2 rounded shrink-0">
                {p.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              &ldquo;{p.text}&rdquo;
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
