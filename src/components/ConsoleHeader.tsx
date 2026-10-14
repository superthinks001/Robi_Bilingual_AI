import React from 'react';
import { Smartphone, Cpu, Monitor, Radio, Languages, SlidersHorizontal } from 'lucide-react';
import { ConnectionState, DeviceMode } from '../types';

interface ConsoleHeaderProps {
  deviceMode: DeviceMode;
  onSelectDeviceMode: (mode: DeviceMode) => void;
  connectionState: ConnectionState;
  onToggleConnection: () => void;
  onOpenDiagnostics: () => void;
  languageMode: 'bilingual' | 'english' | 'spanish';
  onToggleLanguage: () => void;
}

export const ConsoleHeader: React.FC<ConsoleHeaderProps> = ({
  deviceMode,
  onSelectDeviceMode,
  connectionState,
  onToggleConnection,
  onOpenDiagnostics,
  languageMode,
  onToggleLanguage,
}) => {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
      
      {/* Brand Zone */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold text-sm shadow-md shadow-cyan-500/20">
          K1
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>Educational Social Robot</span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.2 rounded">
              Phase 1
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Gemini Multimodal Live Pipeline · Hardware Prototype
          </p>
        </div>
      </div>

      {/* Device Mode Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
        <button
          onClick={() => onSelectDeviceMode('iphone')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
            deviceMode === 'iphone'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Optimized for iPhone camera, microphone & touch screen"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">iPhone Head</span>
        </button>

        <button
          onClick={() => onSelectDeviceMode('pi')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
            deviceMode === 'pi'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Connect to Raspberry Pi 5 network bridge"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Raspberry Pi 5</span>
        </button>

        <button
          onClick={() => onSelectDeviceMode('desktop')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
            deviceMode === 'desktop'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Full Desktop Testing Sandbox"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Desktop</span>
        </button>
      </div>

      {/* Right Controls: Language, Diagnostics & Connect Button */}
      <div className="flex items-center gap-2">
        
        {/* Language selector toggle */}
        <button
          onClick={onToggleLanguage}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/60"
          title="Cycle language prompt focus (Bilingual / English / Spanish)"
        >
          <Languages className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold capitalize">
            {languageMode === 'bilingual' ? 'EN / ES (Mixed)' : languageMode}
          </span>
        </button>

        {/* Diagnostics Drawer trigger */}
        <button
          onClick={onOpenDiagnostics}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          title="View Pi 5 network bridge, latency and telemetry"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Live Connect / Disconnect Button */}
        <button
          onClick={onToggleConnection}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
            isConnected
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
              : isConnecting
              ? 'bg-amber-600 text-white animate-pulse'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse' : ''}`} />
          <span>
            {isConnected ? 'Gemini Live: ON' : isConnecting ? 'Connecting...' : 'Connect Gemini Live'}
          </span>
        </button>
      </div>
    </header>
  );
};
