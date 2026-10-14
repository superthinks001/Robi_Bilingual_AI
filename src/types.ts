export type RobotEmotion = 'idle' | 'listening' | 'speaking' | 'thinking' | 'happy' | 'curious' | 'sleeping' | 'surprised';

export type DeviceMode = 'iphone' | 'pi' | 'desktop';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  language?: 'en' | 'es' | 'spanglish';
  detectedObjects?: string[];
  audioBase64?: string;
}

export interface PiTelemetry {
  targetIp: string;
  reachable: boolean;
  simulated: boolean;
  telemetry: {
    cpuUsagePercent: number;
    memoryUsedMB: number;
    memoryTotalMB: number;
    temperatureC: number;
    cameraStatus: string;
    audioInput: string;
    audioOutput: string;
    pingMs: number;
  };
}

export interface SessionMetrics {
  totalTurns: number;
  speechLatencyMs: number;
  tokensConsumedEstimate: number;
  lastInterruptionTimestamp?: number;
  videoFramesSent: number;
  audioChunksExchanged: number;
}
