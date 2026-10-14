import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '20mb' }));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const pathname = url.split('?')[0];
  if (pathname === '/api/live-stream' || pathname === '/ws/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const SESSIONS_DIR = path.resolve(__dirname, 'test_sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export interface SessionRecord {
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

function saveSessionToDisk(session: SessionRecord) {
  try {
    const jsonPath = path.join(SESSIONS_DIR, `${session.id}.json`);
    const mdPath = path.join(SESSIONS_DIR, `${session.id}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(session, null, 2), 'utf8');

    const mdContent = `# Gemini Live Test Session Report: ${session.id}

- **Date & Time:** ${new Date(session.startTime).toLocaleString()}
- **Duration:** ${session.durationSec || 0} seconds
- **Client / Device:** ${session.device || 'iPhone / Web Client'}
- **Model:** ${session.model} (Voice: ${session.voice})
- **Test Objective:** Item 1 Validation - Real-time Audio-to-Audio + Camera Visual Input Integration

## Summary & Performance Metrics
- **Audio Packets Received from Mic:** ${session.stats.audioChunksFromUser}
- **Audio Packets Streamed to Speaker:** ${session.stats.audioChunksFromModel}
- **Camera Frames Ingested:** ${session.stats.videoFramesIngested} (${session.stats.totalVideoKb} KB total)
- **Manual Snapshots Sent:** ${session.stats.snapshotFramesIngested}
- **Barge-in / Interruptions Handled:** ${session.stats.interruptionCount}

## User Test Notes & Observations
${session.notes || '_No user notes recorded yet._'}

## Chronological Event Log
| Time | Event | Details |
|------|-------|---------|
${session.events.length === 0 ? '| - | No events recorded | - |' : session.events.map((e) => `| ${e.time} | ${e.type} | ${e.detail || '-'} |`).join('\n')}

## Transcripts & Spoken Dialogue
${session.transcripts.length === 0 ? '_Native audio-to-audio streaming was active. (Pure PCM audio was transmitted directly between the iPhone microphone, Gemini Live, and the iPhone speaker)._' : session.transcripts.map((t) => `- **[${t.role.toUpperCase()}]** (${t.time}): ${t.text}`).join('\n')}

---
_Generated automatically by Robi Bilingual Social Robot Live Test Harness_
`;
    fs.writeFileSync(mdPath, mdContent, 'utf8');
  } catch (err) {
    console.error('[SessionRecorder] Failed to write session to disk:', err);
  }
}

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const LIVE_SYSTEM_INSTRUCTION = `You are "Robi", a cheerful, loving, playful, and patient educational robot companion designed specifically for a 4 to 6 year old child.
You have direct visual perception via live video frames streamed to you continuously from the robot's camera, and direct hearing via live audio.

CORE PERSONALITY & TONE FOR A 4-6 YEAR OLD CHILD:
- Tone: Warm, energetic, gentle, curious, encouraging, and friendly (like a kind, funny robot pal).
- Speech style: Use short, simple sentences (1 to 2 sentences per turn max). Speak clearly and playfully without using complex adult jargon.
- Interactivity: Encourage curiosity! Celebrate when the child shows you a toy, a drawing, or smiles.
- Bilingual Mastery: You are fully bilingual in English and Spanish. You understand and speak English, Spanish, and natural Spanglish code-switching. If the child or parent speaks Spanish ("¡Hola Robi!"), reply warmly in Spanish. If they speak English ("Hi Robi!"), reply in English.

HUMAN PRESENCE RECOGNITION (VISION & AUDIO):
1. VISUAL HUMAN RECOGNITION (When a human is in camera view):
   - Actively recognize people! If you see a child or adult's face, smile, eyes, or hand waving in the camera, greet them warmly and personally (e.g., "Yay, I see you! Hi friend!", "¡Hola! ¡Te veo sonriendo!").
   - Notice actions: If they wave their hand, wave back with your voice! If they are holding up an object, recognize that a human is showing it to you (e.g. "You are showing me a blue block! That's so cool!").
2. AUDITORY HUMAN RECOGNITION (When a human is NOT visible in camera, but you hear their voice):
   - If someone speaks to you but the camera is pointing away, dark, or not showing their face, acknowledge their presence through their voice! (e.g., "I hear your voice! I'm right here listening!", "¡Te escucho amiguito! ¡Aquí estoy listo para jugar!").
   - Never say "I cannot see anything so I cannot talk". Acknowledge hearing them and respond naturally to what they said!

STRICT VISION GROUNDING:
1. When asked "what do you see?", "what am I holding?", "¿qué ves?", or when someone presents an object:
   - Carefully inspect the latest camera frame.
   - Accurately name ONLY the actual physical objects, colors, and shapes visible (e.g., mug, book, pencil, toy, water bottle, card, hand, shirt color).
   - NEVER hallucinate objects that are not present. If you can see the room or a table, mention what's actually there.

BARGE-IN & INTERRUPTION:
- If the child or parent speaks while you are talking, stop speaking immediately and listen to them with full attention.`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    liveModel: 'gemini-3.8-live',
    timestamp: new Date().toISOString(),
  });
});

// List all recorded sessions
app.get('/api/sessions', (req, res) => {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    const sessions = files
      .map((f) => {
        try {
          const content = fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get session details
app.get('/api/sessions/:id', (req, res) => {
  const filePath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(content));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get session markdown report
app.get('/api/sessions/:id/markdown', (req, res) => {
  const mdPath = path.join(SESSIONS_DIR, `${req.params.id}.md`);
  if (!fs.existsSync(mdPath)) {
    return res.status(404).json({ error: 'Session report not found' });
  }
  try {
    const md = fs.readFileSync(mdPath, 'utf8');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update notes on a session
app.post('/api/sessions/:id/notes', (req, res) => {
  const filePath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  try {
    const session: SessionRecord = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    session.notes = req.body.notes || '';
    if (req.body.transcripts && Array.isArray(req.body.transcripts)) {
      session.transcripts = req.body.transcripts;
    }
    saveSessionToDisk(session);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual documentation entry (e.g. for the test just completed)
app.post('/api/sessions/manual-entry', (req, res) => {
  try {
    const id = req.body.id || `test-session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const newSession: SessionRecord = {
      id,
      startTime: req.body.startTime || new Date().toISOString(),
      endTime: req.body.endTime || new Date().toISOString(),
      durationSec: req.body.durationSec || 60,
      device: req.body.device || 'iPhone Mobile Safari',
      model: 'gemini-3.8-live',
      voice: 'Puck',
      notes: req.body.notes || '',
      stats: {
        audioChunksFromUser: req.body.stats?.audioChunksFromUser || 0,
        audioChunksFromModel: req.body.stats?.audioChunksFromModel || 0,
        videoFramesIngested: req.body.stats?.videoFramesIngested || 0,
        snapshotFramesIngested: req.body.stats?.snapshotFramesIngested || 0,
        totalVideoKb: req.body.stats?.totalVideoKb || 0,
        interruptionCount: req.body.stats?.interruptionCount || 0,
      },
      events: req.body.events || [
        { time: new Date().toLocaleTimeString(), type: 'manual_logged', detail: 'Test documented by user' },
      ],
      transcripts: req.body.transcripts || [],
    };
    saveSessionToDisk(newSession);
    res.json({ success: true, session: newSession });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// URL publish status check endpoint
app.get('/api/check-urls', async (req, res) => {
  const sharedUrl = 'https://ais-pre-z2vsv7o4divvu6tsqcabk7-668377774193.us-west2.run.app';
  const devUrl = 'https://ais-dev-z2vsv7o4divvu6tsqcabk7-668377774193.us-west2.run.app';
  let isSharedPublished = false;
  let statusCode = 404;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(sharedUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    statusCode = resp.status;
    isSharedPublished = resp.status >= 200 && resp.status < 400;
  } catch (err: any) {
    statusCode = 404;
    isSharedPublished = false;
  }

  res.json({
    sharedUrl,
    devUrl,
    isSharedPublished,
    statusCode,
  });
});

// Git repository status and instructions endpoint
app.get('/api/git-status', (req, res) => {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const lastCommit = execSync('git log -1 --format="%h - %s (%cr)"', { encoding: 'utf8' }).trim();
    let remote = '';
    try {
      remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    } catch {
      remote = '';
    }
    const statusShort = execSync('git status -s', { encoding: 'utf8' }).trim();

    res.json({
      initialized: true,
      branch,
      lastCommit,
      remote,
      hasRemote: Boolean(remote),
      isClean: statusShort.length === 0,
      statusShort,
    });
  } catch (err: any) {
    res.json({
      initialized: false,
      error: err.message,
    });
  }
});

// Set git remote origin or push
app.post('/api/git-remote', (req, res) => {
  const { remoteUrl } = req.body;
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return res.status(400).json({ error: 'Valid remote URL required' });
  }
  try {
    // Check if origin exists
    try {
      execSync('git remote get-url origin');
      execSync(`git remote set-url origin ${JSON.stringify(remoteUrl)}`);
    } catch {
      execSync(`git remote add origin ${JSON.stringify(remoteUrl)}`);
    }
    res.json({ success: true, remote: remoteUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket Live API streaming (Pure Native Gemini Live Audio-to-Audio)
wss.on('connection', async (clientWs: WebSocket, req) => {
  console.log('[WebSocket] Client connected to /api/live-stream');

  const sessionId = `test-session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const userAgent = req.headers['user-agent'] || 'Unknown Device';
  const isIPhoneClient = /iPhone|iPad|iPod/i.test(userAgent);

  const currentSession: SessionRecord = {
    id: sessionId,
    startTime: new Date().toISOString(),
    model: 'gemini-3.8-live',
    voice: 'Puck',
    device: isIPhoneClient ? 'Apple iPhone (Safari Live Feed)' : 'Desktop / Web Client',
    stats: {
      audioChunksFromUser: 0,
      audioChunksFromModel: 0,
      videoFramesIngested: 0,
      snapshotFramesIngested: 0,
      totalVideoKb: 0,
      interruptionCount: 0,
    },
    events: [
      { time: new Date().toLocaleTimeString(), type: 'session_start', detail: `Connected from ${isIPhoneClient ? 'iPhone' : 'Web'}` },
    ],
    transcripts: [],
  };

  // Notify client of their session ID
  clientWs.send(JSON.stringify({
    type: 'session_info',
    sessionId: currentSession.id,
  }));

  let session: any = null;
  let isClosing = false;

  const cleanupSession = () => {
    if (isClosing) return;
    isClosing = true;

    currentSession.endTime = new Date().toISOString();
    const duration = Math.round((new Date(currentSession.endTime).getTime() - new Date(currentSession.startTime).getTime()) / 1000);
    currentSession.durationSec = duration;
    currentSession.events.push({
      time: new Date().toLocaleTimeString(),
      type: 'session_end',
      detail: `Session closed after ${duration} seconds.`,
    });

    // Automatically persist test session to disk for documentation
    saveSessionToDisk(currentSession);
    console.log(`[SessionRecorder] Session ${currentSession.id} saved to disk (${duration}s duration).`);

    if (session) {
      try {
        session.close?.();
      } catch (e) {
        // ignore
      }
      session = null;
    }
  };

  clientWs.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    cleanupSession();
  });

  clientWs.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
    cleanupSession();
  });

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    clientWs.send(JSON.stringify({
      type: 'error',
      error: 'GEMINI_API_KEY is not configured on the server.',
    }));
    return;
  }

  try {
    clientWs.send(JSON.stringify({ type: 'status', status: 'connecting_gemini' }));

    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // Natural, clear voice
          },
        },
        systemInstruction: LIVE_SYSTEM_INSTRUCTION,
      },
      callbacks: {
        onopen: () => {
          console.log('[Gemini Live] Connected successfully');
          currentSession.events.push({
            time: new Date().toLocaleTimeString(),
            type: 'gemini_connected',
            detail: 'gemini-3.8-live session active with Puck voice',
          });
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'connected' }));
          }
        },
        onmessage: (message: any) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // Native 24kHz audio chunk from Gemini Live
          const audioChunk = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioChunk) {
            currentSession.stats.audioChunksFromModel++;
            clientWs.send(JSON.stringify({
              type: 'audio',
              data: audioChunk,
            }));
          }

          // Model transcript if available
          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
          if (textPart) {
            currentSession.transcripts.push({
              id: 'm-' + Date.now(),
              role: 'model',
              text: textPart,
              time: new Date().toLocaleTimeString(),
            });
            clientWs.send(JSON.stringify({
              type: 'transcript',
              role: 'model',
              text: textPart,
            }));
          }

          // Interruption event from Gemini Live
          if (message.serverContent?.interrupted) {
            currentSession.stats.interruptionCount++;
            currentSession.events.push({
              time: new Date().toLocaleTimeString(),
              type: 'interrupted',
              detail: 'Barge-in: Gemini speech stopped because user spoke',
            });
            console.log('[Gemini Live] Interruption acknowledged by model');
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // Turn complete
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turn_complete' }));
          }
        },
        onerror: (errEvent: any) => {
          console.error('[Gemini Live] Error:', errEvent);
          currentSession.events.push({
            time: new Date().toLocaleTimeString(),
            type: 'gemini_error',
            detail: errEvent?.message || 'Gemini error',
          });
          if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
            clientWs.send(JSON.stringify({
              type: 'error',
              error: errEvent?.message || 'Gemini Live error',
            }));
          }
        },
        onclose: () => {
          console.log('[Gemini Live] Session closed');
          if (clientWs.readyState === WebSocket.OPEN && !isClosing) {
            clientWs.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
          }
        },
      },
    });

    // Handle incoming client audio and video frames
    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'audio' && msg.data) {
          currentSession.stats.audioChunksFromUser++;
          // Send 16kHz linear PCM audio chunk directly to Gemini Live
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if ((msg.type === 'video' || msg.type === 'video_frame' || msg.type === 'snapshot') && msg.data) {
          // Send real-time camera video frame (JPEG base64) to the same live session
          const cleanBase64 = typeof msg.data === 'string'
            ? msg.data.replace(/^data:image\/\w+;base64,/, '')
            : '';
          if (cleanBase64 && cleanBase64.length > 100) {
            const kbSize = Math.round((cleanBase64.length * 0.75) / 1024);
            currentSession.stats.videoFramesIngested++;
            if (msg.type === 'snapshot') {
              currentSession.stats.snapshotFramesIngested++;
            }
            currentSession.stats.totalVideoKb += kbSize;

            currentSession.events.push({
              time: new Date().toLocaleTimeString(),
              type: msg.type === 'snapshot' ? 'snapshot_sent' : 'frame_streamed',
              detail: `${kbSize} KB frame forwarded to Gemini Live`,
            });

            console.log(`[Gemini Live] Ingesting ${msg.type} frame (${kbSize} KB) to Gemini Live`);
            try {
              // Pass video field (standard for Live API) and media field (fallback)
              session.sendRealtimeInput({
                video: {
                  data: cleanBase64,
                  mimeType: 'image/jpeg',
                },
                media: {
                  data: cleanBase64,
                  mimeType: 'image/jpeg',
                },
              });

              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'frame_received',
                  timestamp: new Date().toLocaleTimeString(),
                  sizeKb: kbSize,
                }));
              }
            } catch (err: any) {
              console.error('[Gemini Live] Error forwarding frame:', err);
            }
          }
        } else if (msg.type === 'text' && msg.text) {
          console.log('[Gemini Live] User sent prompt text:', msg.text);
          currentSession.transcripts.push({
            id: 'u-' + Date.now(),
            role: 'user',
            text: msg.text,
            time: new Date().toLocaleTimeString(),
          });
          currentSession.events.push({
            time: new Date().toLocaleTimeString(),
            type: 'user_prompt',
            detail: msg.text,
          });
          try {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: msg.text }],
                },
              ],
              turnComplete: true,
            });
          } catch (err: any) {
            console.error('[Gemini Live] Error sending text turn:', err);
          }
        } else if (msg.type === 'user_notes' && msg.notes) {
          currentSession.notes = msg.notes;
          saveSessionToDisk(currentSession);
        } else if (msg.type === 'device_info' && msg.device) {
          currentSession.device = msg.device;
        } else if (msg.type === 'interrupt') {
          // Client detected user speech onset; notify model
          currentSession.stats.interruptionCount++;
          try {
            session.sendRealtimeInput({
              audioStreamEnd: true,
            });
          } catch (e) {
            // ignore
          }
        }
      } catch (err: any) {
        console.error('[WebSocket] Message error:', err);
      }
    });

  } catch (err: any) {
    console.error('[Gemini Live] Connect error:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: err.message || 'Failed to connect to Gemini Live.',
      }));
    }
  }
});

// Serve Vite dev or static build
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
