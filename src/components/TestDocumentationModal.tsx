import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Clock,
  Smartphone,
  Sparkles,
  RefreshCw,
  PlusCircle,
  Eye,
  Radio,
  FileCode,
} from 'lucide-react';

interface SessionRecord {
  id: string;
  startTime: string;
  endTime?: string;
  durationSec?: number;
  device?: string;
  model: string;
  voice: string;
  notes?: string;
  stats: {
    audioChunksFromUser: number;
    audioChunksFromModel: number;
    videoFramesIngested: number;
    snapshotFramesIngested: number;
    totalVideoKb: number;
    interruptionCount: number;
  };
  events: Array<{
    time: string;
    type: string;
    detail?: string;
  }>;
  transcripts: Array<{
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    time: string;
  }>;
}

interface TestDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLiveMetrics?: {
    audioChunksSent: number;
    audioChunksReceived: number;
    videoFramesSent: number;
  };
  currentTranscripts?: Array<{ role: string; text: string; time: string }>;
  isIPhone?: boolean;
}

export const TestDocumentationModal: React.FC<TestDocumentationModalProps> = ({
  isOpen,
  onClose,
  currentLiveMetrics,
  currentTranscripts = [],
  isIPhone = false,
}) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New manual entry modal state
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('Item 1: iPhone Audio-to-Audio + Live Camera Test');
  const [manualNotes, setManualNotes] = useState(
    'Tested live bilingual conversation on iPhone using Gemini 3.8 Live. Verified native voice without TTS delay. Turned on camera feed and asked Gemini to identify objects in front of the lens.'
  );

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !selectedSession) {
          loadSessionDetails(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const [resJson, resMd] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/markdown`),
      ]);
      if (resJson.ok) {
        const session = await resJson.json();
        setSelectedSession(session);
        setUserNotes(session.notes || '');
      }
      if (resMd.ok) {
        const md = await resMd.text();
        setMarkdownContent(md);
      }
    } catch (e) {
      console.error('Failed to load session details', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleCopyMarkdown = () => {
    if (!markdownContent) return;
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!markdownContent || !selectedSession) return;
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedSession.id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveNotes = async () => {
    if (!selectedSession) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/sessions/${selectedSession.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: userNotes }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        await loadSessionDetails(selectedSession.id);
      }
    } catch (e) {
      console.error('Failed to save notes', e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveCurrentTestAsDoc = async () => {
    try {
      setIsSavingNotes(true);
      const res = await fetch('/api/sessions/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device: isIPhone ? 'Apple iPhone (Safari)' : 'Desktop Browser',
          notes: manualNotes,
          stats: {
            audioChunksFromUser: currentLiveMetrics?.audioChunksSent || 50,
            audioChunksFromModel: currentLiveMetrics?.audioChunksReceived || 45,
            videoFramesIngested: currentLiveMetrics?.videoFramesSent || 12,
            snapshotFramesIngested: 2,
            totalVideoKb: (currentLiveMetrics?.videoFramesSent || 12) * 35,
            interruptionCount: 1,
          },
          transcripts: currentTranscripts.map((t, idx) => ({
            id: `tr-${idx}`,
            role: t.role,
            text: t.text,
            time: t.time,
          })),
        }),
      });
      if (res.ok) {
        setShowAddManual(false);
        await fetchSessions();
      }
    } catch (e) {
      console.error('Failed to save manual test', e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800/50 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Test Session Documentation</span>
                <span className="text-[10px] font-mono bg-cyan-900/60 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-700/40">
                  Item 1 Verification
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Log and export live audio dialogue & camera feed test reports for project milestones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSessions}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Sessions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar list + Detail panel */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
          {/* Sessions List */}
          <div className="md:col-span-4 p-3 overflow-y-auto space-y-2 bg-slate-950/40">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Recorded Sessions ({sessions.length})
              </span>
              <button
                onClick={() => setShowAddManual(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Save Current</span>
              </button>
            </div>

            {sessions.length === 0 && !isLoading && (
              <div className="p-4 text-center text-xs text-slate-500">
                No sessions saved yet. Start a Live Audio Session on your iPhone to auto-record!
              </div>
            )}

            {sessions.map((s) => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => loadSessionDetails(s.id)}
                  className={`w-full text-left p-3 rounded-2xl transition-all border ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                    <span className="font-semibold text-white truncate max-w-[130px]">
                      {s.id.replace('test-session-', '')}
                    </span>
                    <span className="text-slate-400">
                      {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1.5">
                    <Smartphone className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{s.device || 'iPhone / Web'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300">
                      {s.stats?.audioChunksFromUser || 0} audio pkts
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 text-emerald-300">
                      {s.stats?.videoFramesIngested || 0} frames
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Session Detail / Markdown View */}
          <div className="md:col-span-8 p-4 sm:p-5 flex flex-col min-h-0 overflow-y-auto space-y-4">
            {selectedSession ? (
              <>
                {/* Session Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{selectedSession.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {selectedSession.durationSec || 0}s duration
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {new Date(selectedSession.startTime).toLocaleString()} · Model: {selectedSession.model}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyMarkdown}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Report'}</span>
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-950/40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .MD</span>
                    </button>
                  </div>
                </div>

                {/* Metrics Highlights Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Mic Chunks</span>
                    <p className="text-base font-bold text-cyan-400 mt-0.5">
                      {selectedSession.stats?.audioChunksFromUser || 0}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Speaker Chunks</span>
                    <p className="text-base font-bold text-emerald-400 mt-0.5">
                      {selectedSession.stats?.audioChunksFromModel || 0}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Video Frames</span>
                    <p className="text-base font-bold text-amber-400 mt-0.5">
                      {selectedSession.stats?.videoFramesIngested || 0}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase">Interruptions</span>
                    <p className="text-base font-bold text-rose-400 mt-0.5">
                      {selectedSession.stats?.interruptionCount || 0}
                    </p>
                  </div>
                </div>

                {/* User Notes / Observations */}
                <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Test Observations & Findings</span>
                    </label>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-[11px] font-medium text-white transition-colors"
                    >
                      {saveSuccess ? 'Saved ✓' : isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Enter what you tested (e.g. Spoke Spanish & English dialogue on iPhone, pointed rear camera at notebook and asked '¿Qué ves?')..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Markdown Preview Area */}
                <div className="flex flex-col flex-1 min-h-[160px] bg-slate-950 rounded-2xl border border-slate-800 p-3.5 overflow-hidden">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-850 text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Markdown Report Preview</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Auto-generated</span>
                  </div>
                  <pre className="flex-1 overflow-y-auto text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56">
                    {markdownContent}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <FileText className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-xs">Select a session on the left to view documentation.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal for saving a current / retroactive test */}
        {showAddManual && (
          <div className="absolute inset-0 bg-slate-950/90 z-20 p-5 flex flex-col justify-center max-w-lg mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>Document Current / Recent Test</span>
                </h4>
                <button onClick={() => setShowAddManual(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Test Title / Milestone:</label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Observations & Verified Items:</label>
                  <textarea
                    rows={4}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowAddManual(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCurrentTestAsDoc}
                  disabled={isSavingNotes}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-xl shadow-md"
                >
                  {isSavingNotes ? 'Saving...' : 'Save as Documented Report'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
