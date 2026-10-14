import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, ExternalLink, Copy, Check, Terminal, FolderGit2, X, Download } from 'lucide-react';

interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GitInfo {
  initialized: boolean;
  branch: string;
  lastCommit: string;
  remote: string;
  hasRemote: boolean;
  isClean: boolean;
  statusShort: string;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({ isOpen, onClose }) => {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [remoteUrlInput, setRemoteUrlInput] = useState('');
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const [remoteSavedSuccess, setRemoteSavedSuccess] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/git-status')
      .then((res) => res.json())
      .then((data) => {
        setGitInfo(data);
        if (data.remote) setRemoteUrlInput(data.remote);
      })
      .catch((err) => console.error('Failed to fetch git status:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleSaveRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrlInput.trim()) return;
    setIsSavingRemote(true);
    setRemoteSavedSuccess(false);

    try {
      const res = await fetch('/api/git-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteUrl: remoteUrlInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setRemoteSavedSuccess(true);
        setGitInfo((prev) => (prev ? { ...prev, remote: remoteUrlInput.trim(), hasRemote: true } : null));
        setTimeout(() => setRemoteSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to set git remote:', err);
    } finally {
      setIsSavingRemote(false);
    }
  };

  const defaultPushCommand = gitInfo?.remote
    ? `git push -u origin ${gitInfo.branch || 'main'}`
    : `git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git\ngit push -u origin main`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Git Repository & GitHub Push</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                  Item 1 Committed
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Foundational live audio/video setup + test session logging
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs max-h-[75vh] overflow-y-auto">
          
          {/* Current Git Status Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 font-mono">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-850">
              <span className="text-slate-400 flex items-center gap-1.5 font-sans font-semibold">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                Active Branch:
              </span>
              <span className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                {gitInfo?.branch || 'main'}
              </span>
            </div>

            <div className="flex items-start justify-between text-[11px] pt-1">
              <span className="text-slate-400 flex items-center gap-1.5 font-sans font-semibold shrink-0">
                <GitCommit className="w-4 h-4 text-emerald-400" />
                Latest Commit:
              </span>
              <span className="text-right text-slate-200 text-[10px] ml-2 break-all">
                {gitInfo?.lastCommit || 'feat(core): Item 1 foundation - live audio-video streaming with Gemini Live'}
              </span>
            </div>

            {gitInfo?.remote && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
                <span className="text-slate-400 font-sans font-semibold">Remote (origin):</span>
                <span className="text-cyan-400 truncate max-w-xs">{gitInfo.remote}</span>
              </div>
            )}
          </div>

          {/* GitHub Remote Configuration Form */}
          <form onSubmit={handleSaveRemote} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Set Your GitHub Repository Remote URL:</span>
              {remoteSavedSuccess && (
                <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved!
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://github.com/username/your-repo.git"
                value={remoteUrlInput}
                onChange={(e) => setRemoteUrlInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isSavingRemote || !remoteUrlInput.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shrink-0"
              >
                {isSavingRemote ? 'Saving...' : 'Set Remote'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Paste the HTTPS or SSH clone URL from your newly created empty GitHub repository.
            </p>
          </form>

          {/* Terminal Command Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 font-mono text-[11px]">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                Run in Terminal to Push to GitHub:
              </span>
              <button
                onClick={() => copyToClipboard(defaultPushCommand, 'cmd')}
                className="p-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-colors"
              >
                {copiedSnippet === 'cmd' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-slate-900 p-3 rounded-xl text-cyan-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-850">
              {defaultPushCommand}
            </pre>
          </div>

          {/* Included Files Summary */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">📦 Included in the Baseline Commit:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li><strong className="text-slate-200">server.ts</strong>: Pure native Gemini Live WebSocket server with 16kHz PCM ingestion and 24kHz audio return</li>
              <li><strong className="text-slate-200">Live Camera Ingestion</strong>: Continuous 1.5s video frame ingestion pipeline</li>
              <li><strong className="text-slate-200">test_sessions/</strong>: Persistent session recorder JSON logs & Markdown test reports</li>
              <li><strong className="text-slate-200">utils/audio.ts</strong>: Linear PCM 16-bit resampling and low-latency audio queueing</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <a
            href="https://github.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-4"
          >
            <span>Create new GitHub repo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors text-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
