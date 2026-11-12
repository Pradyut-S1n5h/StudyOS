import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import os from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

const SUPPORTED_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'] as const;
type AiConfiguration = { provider: 'google'; model: typeof SUPPORTED_MODELS[number]; apiKey: string };
const configDirectory = process.env.STUDYOS_DATA_DIR || path.join(os.homedir(), '.studyos');
const configPath = path.join(configDirectory, 'ai-config.enc');
const encryptionKeyPath = path.join(configDirectory, 'ai-config.key');
let aiConfiguration: AiConfiguration | null = null;
let ai: GoogleGenAI | null = null;
const DEFAULT_MODEL: AiConfiguration['model'] = 'gemini-3.8-flash';
const MAX_AI_INPUT_CHARS = 15000;
const AI_TIMEOUT_MS = 40000;
const AI_RETRY_LIMIT = 2;
const AI_RATE_WINDOW_MS = 60000;
const AI_RATE_LIMIT = 20;
const aiRequestCounts = new Map<string, { count: number; resetAt: number }>();

async function getEncryptionKey(): Promise<Buffer> {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await chmod(configDirectory, 0o700);
  try {
    const key = await readFile(encryptionKeyPath);
    await chmod(encryptionKeyPath, 0o600);
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const key = randomBytes(32);
    try {
      await writeFile(encryptionKeyPath, key, { flag: 'wx', mode: 0o600 });
      return key;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError;
      return readFile(encryptionKeyPath);
    }
  }
}

async function persistAiConfiguration(configuration: AiConfiguration | null) {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await chmod(configDirectory, 0o700);
  if (!configuration) {
    const { unlink } = await import('node:fs/promises');
    await unlink(configPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(configuration), 'utf8'), cipher.final()]);
  const temporaryPath = `${configPath}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporaryPath, JSON.stringify({ iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: encrypted.toString('hex') }), { mode: 0o600 });
  await rename(temporaryPath, configPath);
}

async function loadAiConfiguration() {
  try {
    const [key, encryptedFile] = await Promise.all([getEncryptionKey(), readFile(configPath, 'utf8')]);
    const encrypted = JSON.parse(encryptedFile) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.data, 'hex')), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext) as AiConfiguration;
    if (parsed.provider !== 'google' || !SUPPORTED_MODELS.includes(parsed.model) || typeof parsed.apiKey !== 'string' || !parsed.apiKey) {
      throw new Error('Stored AI configuration is invalid');
    }
    aiConfiguration = parsed;
    ai = new GoogleGenAI({ apiKey: parsed.apiKey });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[StudyOS] AI configuration could not be loaded. Reconfigure AI in Settings.');
    }
  }
  if (!aiConfiguration && process.env.GEMINI_API_KEY?.trim()) {
    aiConfiguration = { provider: 'google', model: DEFAULT_MODEL, apiKey: process.env.GEMINI_API_KEY.trim() };
    ai = new GoogleGenAI({ apiKey: aiConfiguration.apiKey });
  }
}

function getAiErrorStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0;
  const status = 'status' in error ? Number(error.status) : 'statusCode' in error ? Number(error.statusCode) : 0;
  return Number.isFinite(status) ? status : 0;
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = getAiErrorStatus(error);
  const code = 'code' in error ? String(error.code) : '';
  return status === 408 || status === 429 || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code);
}

async function generateAiContent(contents: string, generationConfig?: Record<string, unknown>, requestSignal?: AbortSignal) {
  if (!ai || !aiConfiguration) throw new Error('AI is not configured');
  for (let attempt = 0; ; attempt += 1) {
    if (requestSignal?.aborted) throw new Error('AI request was cancelled');
    const controller = new AbortController();
    const abortRequest = () => controller.abort();
    requestSignal?.addEventListener('abort', abortRequest, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, AI_TIMEOUT_MS);
    try {
      return await ai.models.generateContent({
        model: aiConfiguration.model,
        contents,
        config: { ...generationConfig, abortSignal: controller.signal },
      });
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      if (attempt >= AI_RETRY_LIMIT || (!timedOut && !isRetryable(error))) {
        if (timedOut) throw Object.assign(new Error('AI request timed out'), { code: 'ETIMEDOUT' });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
      requestSignal?.removeEventListener('abort', abortRequest);
    }
  }
}

function bindRequestCancellation(req: Request, res: Response) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

function requireAi(res: Response): boolean {
  if (ai) return true;
  res.status(503).json({ error: 'AI is not configured. Open Settings → AI Configuration, add a Google AI API key, and test the connection.' });
  return false;
}

function reportAiFailure(res: Response, operation: string, error: unknown) {
  const status = getAiErrorStatus(error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  console.error(`AI ${operation} failed (status=${status || 'unknown'}, code=${code || 'unknown'}).`);
  if (res.destroyed || res.headersSent) return;
  if (status === 401 || status === 403) {
    res.status(502).json({ error: 'The provider rejected the saved API key. Check or replace it in AI Configuration, then test the connection.' });
  } else if (status === 400) {
    res.status(502).json({ error: 'The provider rejected this request. Confirm the key is a Google AI Studio API key with Gemini API access, then test the selected model in AI Configuration.' });
  } else if (status === 429) {
    res.status(429).json({ error: 'The AI provider is rate-limiting requests or the API quota is exhausted. Wait briefly or check your provider quota.' });
  } else if (status === 404) {
    res.status(502).json({ error: 'The selected model is unavailable for this API key. Choose another model in AI Configuration and test again.' });
  } else if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    res.status(504).json({ error: 'The AI request timed out or the network connection was interrupted. Check your connection and retry.' });
  } else {
    res.status(502).json({ error: `AI ${operation} could not be completed. The provider may be temporarily unavailable; retry shortly.` });
  }
}

function retrievePassages(content: string, question: string) {
  const stopWords = new Set(['about', 'after', 'again', 'also', 'does', 'from', 'have', 'into', 'that', 'their', 'there', 'these', 'they', 'this', 'what', 'when', 'where', 'which', 'with', 'would', 'your']);
  const terms = new Set((question.toLowerCase().match(/[a-z0-9]+/g) || []).filter((term) => term.length > 2 && !stopWords.has(term)));
  if (terms.size === 0) return [];

  const paragraphs: { start: number; end: number; text: string }[] = [];
  const paragraphPattern = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  for (const match of content.matchAll(paragraphPattern)) {
    const text = match[0].trim();
    if (!text) continue;
    const leadingWhitespace = match[0].length - match[0].trimStart().length;
    const start = (match.index || 0) + leadingWhitespace;
    const end = start + text.length;
    for (let offset = start; offset < end; offset += 1200) {
      const passageStart = offset;
      const passageEnd = Math.min(end, offset + 1200);
      paragraphs.push({ start: passageStart, end: passageEnd, text: content.slice(passageStart, passageEnd) });
    }
  }

  return paragraphs
    .map((passage) => ({
      ...passage,
      score: [...terms].reduce((score, term) => score + (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\b`, 'i').test(passage.text) ? 1 : 0), 0),
    }))
    .filter((passage) => passage.score > 0)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, 4)
    .map(({ score: _score, ...passage }, index) => ({ id: `P${index + 1}`, ...passage }));
}

// --- API ROUTES ---

// Health & status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    aiConfigured: !!aiConfiguration,
    provider: aiConfiguration?.provider || null,
    model: aiConfiguration?.model || null,
    time: new Date().toISOString(),
  });
});

app.use('/api/ai', (req: Request, res: Response, next) => {
  const now = Date.now();
  for (const [key, bucket] of aiRequestCounts) {
    if (bucket.resetAt <= now) aiRequestCounts.delete(key);
  }
  const key = req.ip || 'unknown';
  const bucket = aiRequestCounts.get(key);
  if (!bucket && aiRequestCounts.size >= 1000) {
    res.status(503).json({ error: 'AI request capacity is temporarily unavailable. Please retry shortly.' });
    return;
  }
  if (!bucket || bucket.resetAt <= now) {
    aiRequestCounts.set(key, { count: 1, resetAt: now + AI_RATE_WINDOW_MS });
    next();
    return;
  }
  if (bucket.count >= AI_RATE_LIMIT) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    res.status(429).json({ error: 'Too many AI requests. Please wait a minute and retry.' });
    return;
  }
  bucket.count += 1;
  next();
});

app.use('/api/ai', (req: Request, res: Response, next) => {
  if (req.method === 'GET' || req.method === 'DELETE') {
    next();
    return;
  }
  if (!req.is('application/json') || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'AI requests must contain a JSON object.' });
    return;
  }
  next();
});

app.get('/api/ai/config', (_req: Request, res: Response) => {
  res.json({
    configured: !!aiConfiguration,
    provider: aiConfiguration?.provider || 'google',
    model: aiConfiguration?.model || DEFAULT_MODEL,
    supportedModels: SUPPORTED_MODELS,
  });
});

app.put('/api/ai/config', async (req: Request, res: Response) => {
  const { provider = 'google', model = DEFAULT_MODEL, apiKey: submittedKey } = req.body;
  if (provider !== 'google' || typeof model !== 'string' || !SUPPORTED_MODELS.includes(model as AiConfiguration['model'])) {
    res.status(400).json({ error: 'Choose Google Gemini and a supported model.' });
    return;
  }
  if (submittedKey !== undefined && (typeof submittedKey !== 'string' || submittedKey.trim().length < 8 || submittedKey.length > 500)) {
    res.status(400).json({ error: 'Enter a valid Google AI API key.' });
    return;
  }
  const apiKey = typeof submittedKey === 'string' && submittedKey.trim() ? submittedKey.trim() : aiConfiguration?.apiKey;
  if (!apiKey) {
    res.status(400).json({ error: 'Enter a Google AI API key before saving.' });
    return;
  }
  try {
    const nextConfiguration: AiConfiguration = { provider, model: model as AiConfiguration['model'], apiKey };
    await persistAiConfiguration(nextConfiguration);
    aiConfiguration = nextConfiguration;
    ai = new GoogleGenAI({ apiKey });
    res.json({ configured: true, provider, model: nextConfiguration.model });
  } catch {
    console.error('[StudyOS] AI configuration could not be saved.');
    res.status(500).json({ error: 'AI settings could not be securely saved on this server. Check server storage permissions and retry.' });
  }
});

app.delete('/api/ai/config', async (_req: Request, res: Response) => {
  try {
    await persistAiConfiguration(null);
    aiConfiguration = null;
    ai = null;
    res.json({ configured: false });
  } catch {
    console.error('[StudyOS] AI configuration could not be removed.');
    res.status(500).json({ error: 'AI settings could not be removed from this server.' });
  }
});

app.post('/api/ai/diagnostics', async (_req: Request, res: Response) => {
  const results: Record<string, { passed: boolean; message: string }> = {
    backend: { passed: true, message: 'StudyOS backend is responding.' },
    configuration: { passed: !!aiConfiguration, message: aiConfiguration ? 'Provider configuration is saved on the server.' : 'No provider key is configured.' },
    authentication: { passed: false, message: 'Not tested.' },
    model: { passed: false, message: 'Not tested.' },
    generation: { passed: false, message: 'Not tested.' },
    response: { passed: false, message: 'Not tested.' },
  };
  if (ai && aiConfiguration) {
    try {
      const generated = await generateAiContent('Reply with exactly: StudyOS AI is ready.');
      results.authentication = { passed: true, message: 'The provider accepted the saved credentials.' };
      results.model = { passed: true, message: `Model ${aiConfiguration.model} generated a response.` };
      results.generation = { passed: true, message: 'A real test-generation request completed.' };
      results.response = { passed: typeof generated.text === 'string' && generated.text.trim().length > 0, message: generated.text?.trim() ? 'The provider response was parsed successfully.' : 'The provider returned an empty response.' };
    } catch (error) {
      const status = getAiErrorStatus(error);
      const message = status === 401 || status === 403
        ? 'Provider authentication failed. Replace the API key and test again.'
        : status === 400
        ? 'The provider rejected the request. Confirm this is a Google AI Studio API key with Gemini API access and retry.'
        : status === 404
        ? 'The configured model is unavailable. Select another model and test again.'
        : status === 429
        ? 'Provider quota or rate limit reached. Check the provider quota and retry.'
        : 'The provider could not complete a test request. Check network access and retry.';
      results.authentication = { passed: false, message };
      results.model = { passed: false, message };
      results.generation = { passed: false, message };
      results.response = { passed: false, message: 'No valid provider response was received.' };
    }
  }
  res.json({ results, passed: Object.values(results).every((result) => result.passed) });
});

app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 || messages.some((message) =>
    !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 4000
  ) || messages.reduce((length: number, message: { content: string }) => length + message.content.length, 0) > MAX_AI_INPUT_CHARS) {
    res.status(400).json({ error: 'Chat requires 1 to 20 non-empty messages, with no more than 15,000 characters in total.' });
    return;
  }
  if (!requireAi(res) || !ai || !aiConfiguration) return;

  const prompt = `You are StudyOS, a clear and encouraging academic study assistant. Answer the student's latest message accurately, explain uncertainty, and use earlier conversation as context.\n\nCONVERSATION:\n${messages.map((message: { role: string; content: string }) => `${message.role === 'assistant' ? 'StudyOS' : 'Student'}: ${message.content}`).join('\n\n')}\n\nStudyOS:`;
  const signal = bindRequestCancellation(req, res);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, AI_TIMEOUT_MS);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = await ai.models.generateContentStream({
      model: aiConfiguration.model,
      contents: prompt,
      config: { abortSignal: controller.signal },
    });
    for await (const chunk of stream) {
      if (controller.signal.aborted) break;
      if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    if (!controller.signal.aborted) res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) {
      const status = getAiErrorStatus(error);
      const message = status === 401 || status === 403
        ? 'The provider rejected the saved API key. Check it in AI Configuration.'
        : status === 400
        ? 'The provider rejected the request. Confirm the key has Gemini API access and the selected model is available.'
        : status === 429
        ? 'The AI provider quota or rate limit was reached. Wait briefly or check your provider quota.'
        : status === 404
        ? 'The selected model is unavailable. Choose another model in AI Configuration.'
        : 'The AI assistant could not complete this response. Check your connection and retry.';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
});

// 1. AI Notes Generator
app.post('/api/ai/notes', async (req: Request, res: Response) => {
  try {
    const { content, style = 'detailed_explanation', topicTitle = 'Study Material' } = req.body;

    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Study material cannot be empty.' });
      return;
    }
    if (content.length > MAX_AI_INPUT_CHARS) {
      res.status(413).json({ error: `This material exceeds ${MAX_AI_INPUT_CHARS} characters. Split it into smaller sections before generating notes.` });
      return;
    }
    if (typeof topicTitle !== 'string' || topicTitle.length > 200 || !['quick_revision', 'detailed_explanation', 'key_definitions', 'formulas_concepts', 'misconceptions'].includes(style)) {
      res.status(400).json({ error: 'Topic title or note style is invalid.' });
      return;
    }
    if (!requireAi(res) || !ai) return;

    const styleInstructions: Record<string, string> = {
      quick_revision: 'Create high-yield, bullet-pointed rapid revision notes focusing strictly on essential facts, summary tables, and memory hooks.',
      detailed_explanation: 'Provide a structured, deep-dive academic explanation breaking down the core mechanisms, underlying principles, and logical flow.',
      key_definitions: 'Focus primarily on comprehensive, accurate definitions of all key terms, jargon, and components with clear context.',
      formulas_concepts: 'Highlight all key laws, formulas, mathematical relationships, chemical reactions, or algorithmic invariants, explaining variables and significance.',
      misconceptions: 'Explicitly identify frequent student mistakes, confusing distinctions, and common misconceptions contrasted with correct scientific facts.',
    };

    const instruction = styleInstructions[style] || styleInstructions.detailed_explanation;

    const prompt = `You are StudyOS, an expert academic tutor. Generate accurate notes based only on the supplied study material.

TOPIC: ${topicTitle}
STYLE: ${instruction}

STUDY MATERIAL:
"""
${content.slice(0, 15000)}
"""

Use the requested style throughout. Clearly label facts stated in the source as "From the supplied material". If adding a clarifying explanation not stated by the source, place it in a separate "Additional explanation" section and do not imply the source said it. Do not invent facts, definitions, examples, or conclusions absent from the source. Return useful Markdown notes and 3-5 takeaways grounded in the source.`;

    const response = await generateAiContent(prompt);

    const markdownContent = response.text?.trim();
    if (!markdownContent) throw new Error('Model returned empty notes');

    // Extract takeaways
    const takeawaysMatch = markdownContent.match(/Critical Takeaways[\s\S]*?(?=\n#|$)/i);
    let takeaways: string[] = [];
    if (takeawaysMatch) {
      takeaways = takeawaysMatch[0]
        .split('\n')
        .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()))
        .map((l) => l.replace(/^[-*\d.]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    res.json({
      title: `${topicTitle} - ${style.replace(/_/g, ' ').toUpperCase()}`,
      style,
      content: markdownContent,
      keyTakeaways: takeaways,
      sourceExcerptLength: content.length,
    });
  } catch (error: unknown) {
    reportAiFailure(res, 'notes generation', error);
  }
});

// 2. Multi-depth Concept Explanation
app.post('/api/ai/explain', async (req: Request, res: Response) => {
  try {
    const { concept, context = '', depth = 'standard' } = req.body;

    if (typeof concept !== 'string' || !concept.trim()) {
      res.status(400).json({ error: 'A concept is required.' });
      return;
    }
    if (concept.length > 300 || !['beginner', 'standard', 'advanced', 'step_by_step'].includes(depth)) {
      res.status(400).json({ error: 'Concept or explanation depth is invalid.' });
      return;
    }
    if (typeof context !== 'string' || context.length > MAX_AI_INPUT_CHARS) {
      res.status(400).json({ error: `Context must be text no longer than ${MAX_AI_INPUT_CHARS} characters.` });
      return;
    }
    if (!requireAi(res) || !ai) return;

    const depthPrompts: Record<string, string> = {
      beginner: 'Explain this like I am 12 years old (ELI5). Use intuitive real-world analogies (e.g. factories, postal systems, traffic), avoid heavy jargon without explaining it immediately, and build from simple intuition.',
      standard: 'Provide a clear, balanced secondary/collegiate-level explanation with standard academic terminology, clear step-by-step logic, and why this concept matters.',
      advanced: 'Provide an in-depth, rigorous technical and mechanistic explanation suitable for advanced students. Include exact chemical/mathematical/computational details, thermodynamic or complexity implications, and molecular/algorithmic nuances.',
      step_by_step: 'Explain this strictly as a sequential, chronological or algorithmic step-by-step breakdown (Step 1, Step 2, Step 3), highlighting inputs, transformations, and outputs at each phase.',
    };

    const prompt = `You are StudyOS Study Assistant.
Explain the following concept to a student:
CONCEPT: ${concept}
DEPTH LEVEL: ${depth} (${depthPrompts[depth] || depthPrompts.standard})

CONTEXT FROM STUDENT'S MATERIAL:
"""
${context.slice(0, 5000)}
"""

Use the supplied context as the source for claims when it is relevant. Clearly label statements supported by the source separately from general academic explanation; never imply that general explanation came from the student's material. If no context was supplied, do not claim source grounding. Do not invent details when uncertain.

Format your response in Markdown with:
1. One-sentence core summary.
2. The explanation formatted with bold keywords.
3. A memorable analogy or practical example.
4. Two active-recall check questions for the student to self-test their understanding.`;

    const response = await generateAiContent(prompt);

    const explanation = response.text?.trim();
    if (!explanation) throw new Error('Model returned an empty explanation');
    res.json({
      concept,
      depth,
      explanation,
    });
  } catch (error: unknown) {
    reportAiFailure(res, 'explanation', error);
  }
});

// 3. Grounded Question Answering (with material citations)
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  try {
    const { materialContent, question } = req.body;

    if (typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'A question is required.' });
      return;
    }
    if (question.length > 1000) {
      res.status(400).json({ error: 'Question must be 1000 characters or fewer.' });
      return;
    }
    if (typeof materialContent !== 'string' || materialContent.length > 250000) {
      res.status(400).json({ error: 'Active study material must be text no longer than 250000 characters.' });
      return;
    }
    const passages = retrievePassages(materialContent, question);
    if (passages.length === 0) {
      res.json({ answer: 'I could not find a relevant passage in the active study material, so I cannot provide a source-supported answer.', groundedInMaterial: false, sources: [] });
      return;
    }
    if (!requireAi(res) || !ai) return;

    const prompt = `You are StudyOS grounded study assistant. Use only the supplied retrieved passages for source-supported claims. Do not use knowledge outside those passages in the source answer.

RETRIEVED PASSAGES (IDs and character offsets refer to the original material):
${JSON.stringify(passages)}

QUESTION:
${question}

RULES:
Return JSON with sourceAnswer (or empty string if unsupported), generalContext (optional, clearly separate general academic context), and citedPassageIds. Cite only passage IDs whose text supports the sourceAnswer. If the passages do not answer the question, say so in sourceAnswer and leave citedPassageIds empty.`;

    const response = await generateAiContent(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sourceAnswer: { type: Type.STRING },
            generalContext: { type: Type.STRING },
            citedPassageIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['sourceAnswer', 'citedPassageIds'],
        },
    });

    const result = JSON.parse(response.text || '{}');
    if (typeof result.sourceAnswer !== 'string' || !Array.isArray(result.citedPassageIds) || result.citedPassageIds.some((id: unknown) => typeof id !== 'string' || !passages.some((passage) => passage.id === id))) {
      throw new Error('Model returned invalid source references');
    }
    const sources = passages.filter((passage) => result.citedPassageIds.includes(passage.id));
    const sourceAnswer = result.sourceAnswer.trim();
    const generalContext = typeof result.generalContext === 'string' ? result.generalContext.trim() : '';

    res.json({
      answer: sourceAnswer || 'The retrieved passages do not provide enough information to answer this question.',
      groundedInMaterial: !!sourceAnswer && sources.length > 0,
      generalContext,
      sources: sources.map(({ id, start, end, text }) => ({ id, start, end, quote: text })),
    });
  } catch (error: unknown) {
    reportAiFailure(res, 'question answering', error);
  }
});

// 4. Structured Quiz Generation (JSON Schema)
app.post('/api/ai/quiz', async (req: Request, res: Response) => {
  try {
    const {
      materialContent,
      topicTitle = 'Study Material',
      questionCount = 4,
      difficulty = 'medium',
      includeShortAnswer = false,
      targetConcept,
    } = req.body;

    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 2 || count > 10) {
      res.status(400).json({ error: 'Question count must be an integer from 2 to 10.' });
      return;
    }
    if (typeof materialContent !== 'string' || !materialContent.trim()) {
      res.status(400).json({ error: 'Study material cannot be empty.' });
      return;
    }
    if (materialContent.length > MAX_AI_INPUT_CHARS) {
      res.status(413).json({ error: `This material exceeds ${MAX_AI_INPUT_CHARS} characters. Split it into smaller sections to generate a quiz.` });
      return;
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty) || typeof includeShortAnswer !== 'boolean') {
      res.status(400).json({ error: 'Difficulty or short-answer settings are invalid.' });
      return;
    }
    if (typeof topicTitle !== 'string' || !topicTitle.trim() || topicTitle.length > 200) {
      res.status(400).json({ error: 'Topic title must contain 1 to 200 characters.' });
      return;
    }
    if (targetConcept !== undefined && (typeof targetConcept !== 'string' || targetConcept.length > 200)) {
      res.status(400).json({ error: 'Target concept must be 200 characters or fewer.' });
      return;
    }
    if (!requireAi(res) || !ai) return;

    const prompt = `Generate a rigorous, high-quality diagnostic quiz based on the following study material.

TOPIC: ${topicTitle}
FOCUS CONCEPT: ${targetConcept || 'Balanced coverage across the supplied material'}
TARGET NUMBER OF QUESTIONS: ${count}
TARGET DIFFICULTY: ${difficulty}
INCLUDE SHORT ANSWER: ${includeShortAnswer}

STUDY MATERIAL:
"""
${materialContent}
"""

CRITICAL INSTRUCTIONS:
- Generate exactly ${count} questions.
- If includeShortAnswer is true, include 1 short_answer question and ${count - 1} mcq questions. If false, make all questions 'mcq'.
- For 'mcq', provide exactly 4 realistic, plausible options. Only ONE option must be unambiguously correct.
- Set correctAnswer as the 0-indexed index of the correct option (0, 1, 2, or 3).
- Provide a detailed explanation explaining why the correct answer is right and why the main distractor is incorrect.
- Provide a specific 'concept' label (e.g. "Photolysis & PSII", "Calvin Cycle Reduction", "Big-O Analysis").
- When a focus concept is specified, every question must directly test that concept and not unrelated topics.
- Test actual conceptual understanding, mechanisms, and application rather than trivial verbatim word-matching.`;

    const response = await generateAiContent(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quizTitle: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: '"mcq" or "short_answer"' },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '4 options for MCQ, empty array for short_answer',
                  },
                  correctAnswer: {
                    type: Type.INTEGER,
                    description: '0-based index of correct option for MCQ (0, 1, 2, or 3)',
                  },
                  expectedAnswer: {
                    type: Type.STRING,
                    description: 'Concise model answer for short_answer',
                  },
                  explanation: { type: Type.STRING },
                  concept: { type: Type.STRING, description: 'Short concept tag' },
                  difficulty: { type: Type.STRING },
                },
                required: ['type', 'question', 'explanation', 'concept'],
              },
            },
          },
          required: ['quizTitle', 'questions'],
        },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (typeof parsed.quizTitle !== 'string' || !parsed.quizTitle.trim() || !Array.isArray(parsed.questions) || parsed.questions.length !== count) {
      throw new Error('Model returned an incorrect question count or missing quiz title');
    }
    const questionTypesValid = parsed.questions.every((q: any) => {
      if (!q || !['mcq', 'short_answer'].includes(q.type) || typeof q.question !== 'string' || !q.question.trim() || typeof q.explanation !== 'string' || !q.explanation.trim() || typeof q.concept !== 'string' || !q.concept.trim() || !['easy', 'medium', 'hard'].includes(q.difficulty || difficulty)) return false;
      if (q.type === 'mcq') return Array.isArray(q.options) && q.options.length === 4 && q.options.every((option: unknown) => typeof option === 'string' && option.trim()) && new Set(q.options.map((option: string) => option.trim().toLowerCase())).size === 4 && Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer < 4;
      return typeof q.expectedAnswer === 'string' && !!q.expectedAnswer.trim();
    });
    const shortAnswers = parsed.questions.filter((q: any) => q.type === 'short_answer').length;
    if (!questionTypesValid || shortAnswers !== (includeShortAnswer ? 1 : 0)) {
      throw new Error('Model returned invalid or incomplete questions');
    }
    const sanitizedQuestions = parsed.questions.map((q: any, i: number) => ({
      id: `q-${Date.now()}-${i + 1}`,
      type: q.type,
      question: q.question.trim(),
      options: q.type === 'mcq' ? q.options.map((option: string) => option.trim()) : [],
      correctAnswer: q.type === 'mcq' ? q.correctAnswer : -1,
      expectedAnswer: q.type === 'short_answer' ? q.expectedAnswer.trim() : undefined,
      explanation: q.explanation.trim(),
      concept: q.concept.trim(),
      difficulty: q.difficulty || difficulty,
    }));

    res.json({
      title: parsed.quizTitle || `${topicTitle} Diagnostic Quiz`,
      difficulty,
      questions: sanitizedQuestions,
    });
  } catch (error: unknown) {
    reportAiFailure(res, 'quiz generation', error);
  }
});

// 5. Short Answer AI Evaluation
app.post('/api/ai/evaluate-answer', async (req: Request, res: Response) => {
  try {
    const { question, expectedAnswer, studentAnswer, concept } = req.body;

    if (typeof question !== 'string' || !question.trim() || typeof studentAnswer !== 'string' || !studentAnswer.trim() || typeof expectedAnswer !== 'string' || !expectedAnswer.trim()) {
      res.status(400).json({ error: 'Question, expected answer, and student answer are required.' });
      return;
    }
    if (!requireAi(res) || !ai) return;

    const prompt = `You are StudyOS automated academic grader. Evaluate the student's short answer against the expected answer and question.

QUESTION: ${question}
CONCEPT: ${concept || 'General'}
EXPECTED ANSWER: ${expectedAnswer}
STUDENT ANSWER: ${studentAnswer}

Evaluate conceptual accuracy, whether required points are present, incorrect claims, omissions, and relevant reasoning. Return score 0-100; correctness must be true exactly when score >= 70. Include specific arrays of what the student understood correctly, what was missing, and what to review. Do not infer correctness from keyword overlap.`;

    const response = await generateAiContent(prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: 'Score between 0 and 100' },
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: 'Constructive feedback' },
            understood: { type: Type.ARRAY, items: { type: Type.STRING } },
            missing: { type: Type.ARRAY, items: { type: Type.STRING } },
            review: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'isCorrect', 'feedback', 'understood', 'missing', 'review'],
        },
    });

    const result = JSON.parse(response.text || '{}');
    if (!Number.isInteger(result.score) || result.score < 0 || result.score > 100 || typeof result.isCorrect !== 'boolean' || result.isCorrect !== (result.score >= 70) || typeof result.feedback !== 'string' || !result.feedback.trim() || !['understood', 'missing', 'review'].every((key) => Array.isArray(result[key]) && result[key].every((item: unknown) => typeof item === 'string'))) {
      throw new Error('Model returned an invalid grading result');
    }
    res.json({
      score: result.score,
      isCorrect: result.isCorrect,
      feedback: result.feedback,
      understood: result.understood,
      missing: result.missing,
      review: result.review,
      expectedAnswer,
      evaluationMethod: 'ai',
    });
  } catch (error: unknown) {
    reportAiFailure(res, 'answer grading', error);
  }
});

// --- VITE MIDDLEWARE INTEGRATION ---
app.use((error: unknown, req: Request, res: Response, next: (error?: unknown) => void) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 500;
  const safeStatus = status === 413 ? 413 : status === 400 ? 400 : 500;
  if (safeStatus === 500) console.error('[StudyOS] Request processing failed.');
  res.status(safeStatus).json({
    error: safeStatus === 413
      ? 'Request body is too large.'
      : safeStatus === 400
      ? 'Request body contains invalid JSON.'
      : 'Request could not be completed.',
  });
});

async function startServer() {
  await loadAiConfiguration();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[StudyOS] Server listening on port ${PORT}`);
    console.log(`[StudyOS] Gemini API initialized: ${!!ai}`);
  });
}

startServer().catch((err) => {
  console.error('[StudyOS] Failed to start server:', err);
});
