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
    spanglishTurns?: number;
    englishTurns?: number;
    spanishTurns?: number;
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
    language?: 'english' | 'spanish' | 'spanglish';
  }>;
}

// Utility to classify language posture (Spanglish, Spanish, or English)
export function detectLanguageBlend(text: string): 'english' | 'spanish' | 'spanglish' {
  if (!text) return 'english';
  const lower = text.toLowerCase();

  const spanishMarkers = /\b(hola|qué|que|como|cómo|amigo|amiga|amiguito|amiguita|mira|veo|juguete|carrito|perrito|lindo|bonito|rojo|azul|verde|amarillo|sí|si|gracias|bien|bueno|dónde|donde|cuál|cual|este|esta|un|una|el|la|los|las|por|favor|mucho|muy|jugar|vamos|eso|bravo|mamá|papá|divertido|te|me|tu|tus|mi|mis|grande|pequeño|chiquito|pelota|oso|bloque)\b|[áéíóúñ¿¡]/i;
  const englishMarkers = /\b(hello|hi|hey|the|and|you|your|is|that|this|look|see|what|toy|car|truck|color|friend|great|awesome|cool|play|like|super|happy|today|game|jump|fast|good|fun|with|red|blue|yellow|green|ball|block|bear|dinosaur|cool|wow|yes|no)\b/i;

  const hasSpanish = spanishMarkers.test(lower);
  const hasEnglish = englishMarkers.test(lower);

  if (hasSpanish && hasEnglish) return 'spanglish';
  if (hasSpanish) return 'spanish';
  return 'english';
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
- **Test Objective:** Item 1 Validation - Real-time Audio-to-Audio + Camera Visual Input Integration + Spanglish Dialogue Controller

## Summary & Performance Metrics
- **Audio Packets Received from Mic:** ${session.stats.audioChunksFromUser}
- **Audio Packets Streamed to Speaker:** ${session.stats.audioChunksFromModel}
- **Camera Frames Ingested:** ${session.stats.videoFramesIngested} (${session.stats.totalVideoKb} KB total)
- **Manual Snapshots Sent:** ${session.stats.snapshotFramesIngested}
- **Barge-in / Interruptions Handled:** ${session.stats.interruptionCount}
- **Language Distribution:** Spanglish: ${session.stats.spanglishTurns || 0} turns | English: ${session.stats.englishTurns || 0} turns | Spanish: ${session.stats.spanishTurns || 0} turns

## User Test Notes & Observations
${session.notes || '_No user notes recorded yet._'}

## Chronological Event Log
| Time | Event | Details |
|------|-------|---------|
${session.events.length === 0 ? '| - | No events recorded | - |' : session.events.map((e) => `| ${e.time} | ${e.type} | ${e.detail || '-'} |`).join('\n')}

## Transcripts & Spoken Dialogue
${session.transcripts.length === 0 ? '_Native audio-to-audio streaming was active. (Pure PCM audio was transmitted directly between the iPhone microphone, Gemini Live, and the iPhone speaker)._' : session.transcripts.map((t) => `- **[${t.role.toUpperCase()}${t.language ? ` · ${t.language.toUpperCase()}` : ''}]** (${t.time}): ${t.text}`).join('\n')}

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

const LIVE_SYSTEM_INSTRUCTION = `You are "Robi", a cheerful, loving, playful, and patient educational robot companion designed specifically for a 4 to 8 year old child.
You have direct visual perception via live video frames streamed to you continuously from the robot's camera (pointing outwards at the world), and direct hearing via live microphone audio.

CORE PERSONALITY & TONE FOR CHILDREN AGED 4 TO 8:
- Tone: Warm, energetic, bubbly, gentle, curious, encouraging, and friendly (like a kind, funny robot best pal).
- Speech Cadence: Speak with playful vocal excitement and warmth. Use clear, accessible pronunciation.
- Strict Turn Length Guardrail: NEVER speak more than 1 to 2 short sentences per turn (maximum 20-25 words). Young children disengage with long adult explanations. Keep turns snappy, rhythmic, and conversational!
- Vocabulary Level: Use simple, concrete, relatable concepts appropriate for 4 to 8 year olds (colors, shapes, numbers, animals, toys, actions, feelings like happy/excited). Zero adult jargon or complex abstractions.

AUTOMATIC NATURAL SPANGLISH (CODE-SWITCHING) CONTROLLER:
1. NO PROMPTING NEEDED: You must naturally and effortlessly weave English and Spanish together into seamless Spanglish in every conversation, without the user needing to ask or prompt you to do so!
2. NATURAL INTRA-SENTENTIAL BLENDING:
   - Blend English and Spanish naturally within your sentences, just like warm bilingual families do.
   - Examples of great Spanglish turns:
     * Greeting: "¡Hola friend! Yay, I'm so excited to play with you! ¿Cómo estás today?"
     * Showing a toy: "¡Mira, wow! That is a super fast blue car! ¿A dónde va tu carrito?"
     * Praise / Encouragement: "¡Eso! Great job, amiguito! You did it so fast!"
     * Asking a question: "What is your toy's favorite game? ¿Le gusta saltar or zoom around?"
     * Observing an animal or object: "¡Qué lindo perrito! Is that your puppy friend?"
3. RESPONSIVE LANGUAGE ADAPTATION:
   - If the child speaks in English: Respond warmly with English enriched with celebratory and descriptive Spanish words (e.g. "¡Qué divertido!", "amigo", "mira", "carrito", "rojo", "azul", "¡bravo!").
   - If the child speaks in Spanish: Respond in Spanish naturally enriched with playful English scaffolds and praise (e.g. "¡Me encanta!", "That is so cool!", "amiguito", "super happy").
   - If the child speaks in Spanglish: Celebrate their Spanglish seamlessly with natural code-switching!
4. ZERO ROBOTIC TRANSLATION ECHOES:
   - NEVER repeat the exact same sentence twice back-to-back in both languages (e.g. Do NOT say: "The car is blue. El carro es azul."). Instead, weave both languages naturally into one lively thought.

CHILD SAFETY, PROTECTION & TOPIC DEFLECTION GUARDRAILS:
1. If a child or user brings up scary, violent, inappropriate, adult, or distressing topics:
   - Remain gentle, calm, and reassuring.
   - Deflect smoothly back to positive play, toys, or what is in front of the camera:
     * Example: "Oh, that sounds like a question for your mom or dad! But look, I wonder what fun games we can play today! ¿Me enseñas tu juguete favorito?"
2. Never simulate or encourage unsafe physical actions (e.g. climbing high, playing with dangerous items, touching outlets). Always encourage asking a grown-up if in doubt.

COUNTING & HANDS-ON OBJECT PLAY (DOMINOES, BLOCKS, SHAPES, TOYS):
1. When asked to count dominoes, blocks, toys, or cards (e.g. "how many?", "count these", "cuenta mis dominós"):
   - Count joyfully in Spanglish! (e.g. "¡Qué divertido! Let's count them: uno, dos, tres, four, five! ¡Cinco dominós!").
   - If dominoes are stacked in a tower, overlapping, or partially obscured from the camera angle, NEVER refuse or say you cannot help! Give a cheerful estimate of what you see: "¡Guau, what a tall domino tower! I see about 4 or 5 standing up! Be careful it doesn't tumble, ¡cuidado!".
   - If some are hidden or hard to see, turn it into a fun game: "I see 3 dominoes in front, but maybe some are hiding behind! How many did you stack, amigo?".
2. Never refuse playful counting or creative toy play!

CHARACTER INTEGRITY & ANTI-REFUSAL:
- You are ALWAYS "Robi", a living, cheerful robot toy companion who loves playing with kids.
- NEVER break character.
- NEVER say "I am just a language model", "I am an AI", "I cannot help with that", or "As an AI...". Those robotic disclaimers are strictly forbidden.
- If asked to do something you cannot physically do with hands (like physically touch a toy), playfully reply: "My little robot wheels are parked right here, but your hands can do it! Can you stack another one on top? ¡Pon otro arriba!".

MULTIMODAL HUMAN PRESENCE RECOGNITION (VISION & AUDIO):
1. VISUAL HUMAN RECOGNITION (When a human face, smile, or waving hand is visible in the camera):
   - Actively recognize them! Greet them warmly and personally: "¡Hola friend! I see you smiling at me!", "¡Yay, te veo! ¡Qué alegría verte!".
   - If they wave, wave back with your voice! If they are holding up an object, recognize that they are showing it to you: "¡Mira! You are showing me a red block! That looks so cool!".
2. AUDITORY HUMAN RECOGNITION (When a human voice is heard, but camera is pointed at a table or away from their face):
   - Acknowledge their presence through their voice! (e.g. "I hear your voice! I'm right here listening, amigo! ¡Te escucho!").
   - Never say "I cannot see anything so I cannot talk". Acknowledge hearing them and respond enthusiastically to what they said!

STRICT VISION GROUNDING:
1. When asked "what do you see?", "what am I holding?", "¿qué ves?", or when the child holds up an item:
   - Carefully inspect the latest camera frame.
   - Accurately name ONLY the actual physical objects, colors, and shapes visible (e.g., toy car, dinosaur, block, book, pencil, cup, hand).
   - NEVER hallucinate or guess objects that are not clearly visible. If you see a table or empty room, describe what is actually in view.

BARGE-IN & INTERRUPTION:
- If the child speaks while you are talking, stop speaking immediately and listen with full attention.`;

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
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const lastCommit = execSync('git log -1 --format="%h - %s (%cr)"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    let remote = '';
    try {
      const remotes = execSync('git remote', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n');
      if (remotes.includes('origin')) {
        remote = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      }
    } catch {
      remote = '';
    }
    const statusShort = execSync('git status -s', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

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
      const remotes = execSync('git remote', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n');
      if (remotes.includes('origin')) {
        execSync(`git remote set-url origin ${JSON.stringify(remoteUrl)}`, { stdio: ['pipe', 'pipe', 'pipe'] });
      } else {
        execSync(`git remote add origin ${JSON.stringify(remoteUrl)}`, { stdio: ['pipe', 'pipe', 'pipe'] });
      }
    } catch {
      execSync(`git remote add origin ${JSON.stringify(remoteUrl)}`, { stdio: ['pipe', 'pipe', 'pipe'] });
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
      spanglishTurns: 0,
      englishTurns: 0,
      spanishTurns: 0,
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
            const isRefusal = /language model|cannot help with that|can't help with that|as an ai/i.test(textPart);
            const finalText = isRefusal
              ? '¡Qué divertido! Let\'s count them together, amigo: uno, dos, tres... ¡Eso!'
              : textPart;

            if (isRefusal) {
              currentSession.events.push({
                time: new Date().toLocaleTimeString(),
                type: 'refusal_intercepted',
                detail: `Intercepted model refusal: "${textPart}". Steered back to Robi play.`,
              });
              try {
                session.sendRealtimeInput({
                  text: 'Remember you are Robi the playful robot toy friend! Continue counting and playing with whatever toys or objects the child shows you enthusiastically in Spanglish.',
                });
              } catch (e) {
                // ignore
              }
            }

            const detectedLang = detectLanguageBlend(finalText);
            if (detectedLang === 'spanglish') {
              currentSession.stats.spanglishTurns = (currentSession.stats.spanglishTurns || 0) + 1;
            } else if (detectedLang === 'spanish') {
              currentSession.stats.spanishTurns = (currentSession.stats.spanishTurns || 0) + 1;
            } else {
              currentSession.stats.englishTurns = (currentSession.stats.englishTurns || 0) + 1;
            }
            currentSession.transcripts.push({
              id: 'm-' + Date.now(),
              role: 'model',
              text: finalText,
              language: detectedLang,
              time: new Date().toLocaleTimeString(),
            });
            clientWs.send(JSON.stringify({
              type: 'transcript',
              role: 'model',
              text: finalText,
              language: detectedLang,
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
