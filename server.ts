import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PRIMARY_MODEL = 'gemini-3.8-flash';
const MAX_AI_INPUT_CHARS = 15000;
const AI_TIMEOUT_MS = 40000;
const AI_RATE_WINDOW_MS = 60000;
const AI_RATE_LIMIT = 20;
const aiRequestCounts = new Map<string, { count: number; resetAt: number }>();

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('AI request timed out')), AI_TIMEOUT_MS);
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function requireAi(res: Response): boolean {
  if (ai) return true;
  res.status(503).json({ error: 'AI is unavailable because GEMINI_API_KEY is not configured. Your material was not processed.' });
  return false;
}

function reportAiFailure(res: Response, operation: string, error: unknown) {
  console.error(`AI ${operation} failed.`);
  res.status(502).json({ error: `AI ${operation} failed. Your data was not recorded. Please retry.` });
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
    hasGeminiKey: !!apiKey,
    model: PRIMARY_MODEL,
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
  if (!req.is('application/json') || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'AI requests must contain a JSON object.' });
    return;
  }
  next();
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

    const response = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
    }));

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

    const response = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
    }));

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

    const response = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
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
      },
    }));

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

    const response = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
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
      },
    }));

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

    const response = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
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
      },
    }));

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
