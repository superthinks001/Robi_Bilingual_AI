/**
 * Audio processing utilities for Gemini Live duplex audio-to-audio streaming.
 * Handles downsampling any browser/device microphone rate (44.1kHz, 48kHz, etc.)
 * cleanly to 16,000Hz Linear PCM, and playing native 24,000Hz PCM chunks
 * with zero voice overlap and instant barge-in cancellation.
 */

// Convert Float32Array to 16-bit signed Linear PCM (little-endian) Base64
export function floatTo16BitPCMBase64(input: Float32Array): string {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(output.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Resample Float32 audio buffer from inputSampleRate to 16000Hz 16-bit PCM (little-endian) Base64
export function resampleTo16kPCMBase64(input: Float32Array, inputSampleRate: number): string {
  const targetSampleRate = 16000;
  let resampled: Float32Array;

  if (inputSampleRate === targetSampleRate) {
    resampled = input;
  } else {
    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(input.length / ratio);
    resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const origIndex = i * ratio;
      const indexLow = Math.floor(origIndex);
      const indexHigh = Math.min(indexLow + 1, input.length - 1);
      const weight = origIndex - indexLow;
      resampled[i] = input[indexLow] * (1 - weight) + input[indexHigh] * weight;
    }
  }

  // Convert to 16-bit signed Linear PCM
  const pcm16 = new Int16Array(resampled.length);
  for (let i = 0; i < resampled.length; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Convert to Base64 string
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 16-bit Linear PCM (at 24000Hz) to AudioBuffer
export function pcmBase64ToAudioBuffer(
  base64: string,
  audioCtx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer | null {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    const audioBuffer = audioCtx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.copyToChannel(float32, 0);
    return audioBuffer;
  } catch (err) {
    console.error('Error decoding PCM Base64 to AudioBuffer:', err);
    return null;
  }
}

// Calculate RMS amplitude (0.0 to 1.0)
export function getAudioRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export class LiveAudioPlayer {
  public audioCtx: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onStateChange?: (isPlaying: boolean, amplitude: number) => void;
  private onAmpOnly?: (amp: number) => void;
  private isPlaying: boolean = false;
  private meterInterval: any = null;
  private dataArray: Uint8Array | null = null;

  constructor(callback?: ((isPlaying: boolean, amplitude: number) => void) | ((amp: number) => void)) {
    if (callback) {
      if (callback.length === 1) {
        this.onAmpOnly = callback as (amp: number) => void;
      } else {
        this.onStateChange = callback as (isPlaying: boolean, amplitude: number) => void;
      }
    }
  }

  public setCallback(callback: ((isPlaying: boolean, amplitude: number) => void) | ((amp: number) => void)) {
    if (callback.length === 1) {
      this.onAmpOnly = callback as (amp: number) => void;
    } else {
      this.onStateChange = callback as (isPlaying: boolean, amplitude: number) => void;
    }
  }

  public init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
      try {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3;
        this.analyser.connect(this.audioCtx.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      } catch (e) {
        console.warn('AnalyserNode init caught:', e);
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public enqueueChunk(base64Pcm: string) {
    this.init();
    if (!this.audioCtx) return;

    const buffer = pcmBase64ToAudioBuffer(base64Pcm, this.audioCtx, 24000);
    if (!buffer) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(this.audioCtx.destination);
    }

    const currentTime = this.audioCtx.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime + 0.02; // 20ms lead time to prevent underruns
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;

    this.activeSources.push(source);
    this.setIsPlaying(true);

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      if (this.activeSources.length === 0) {
        this.setIsPlaying(false);
      }
    };
  }

  private startMeterLoop() {
    if (this.meterInterval) return;
    this.meterInterval = setInterval(() => {
      if (!this.isPlaying || !this.analyser || !this.dataArray) {
        return;
      }
      (this.analyser as any).getByteTimeDomainData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = (this.dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rawRms = Math.sqrt(sum / this.dataArray.length);
      // Scale amplitude for vibrant responsive lip movements (0.0 to 1.0)
      const scaledAmp = Math.max(0, Math.min(1, rawRms * 3.2));
      this.onStateChange?.(true, scaledAmp);
      this.onAmpOnly?.(scaledAmp);
    }, 30);
  }

  private stopMeterLoop() {
    if (this.meterInterval) {
      clearInterval(this.meterInterval);
      this.meterInterval = null;
    }
  }

  private setIsPlaying(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      if (playing) {
        this.startMeterLoop();
        this.onStateChange?.(true, 0.4);
        this.onAmpOnly?.(0.4);
      } else {
        this.stopMeterLoop();
        this.onStateChange?.(false, 0);
        this.onAmpOnly?.(0);
      }
    }
  }

  // Instant barge-in stop (< 100ms)
  public flush() {
    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // already stopped
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
    this.setIsPlaying(false);
  }

  public stop() {
    this.flush();
    this.stopMeterLoop();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
