import { NotesStyle, Quiz, QuestionType } from '../types';

export interface GeneratedNotesResponse {
  title: string;
  style: NotesStyle;
  content: string;
  keyTakeaways: string[];
  sourceExcerptLength: number;
}

export interface ExplainResponse {
  concept: string;
  depth: 'beginner' | 'standard' | 'advanced' | 'step_by_step';
  explanation: string;
}

export interface GroundedAskResponse {
  answer: string;
  groundedInMaterial: boolean;
  generalContext?: string;
  sources: { id: string; start: number; end: number; quote: string }[];
}

export interface EvaluateAnswerResponse {
  score: number;
  isCorrect: boolean;
  feedback: string;
  expectedAnswer: string;
  understood: string[];
  missing: string[];
  review: string[];
  evaluationMethod: 'ai' | 'deterministic';
}

export interface AiConfigurationStatus {
  configured: boolean;
  provider: 'google';
  model: string;
  supportedModels: string[];
}

export interface AiDiagnosticResult {
  passed: boolean;
  message: string;
}

export interface AiDiagnostics {
  results: Record<string, AiDiagnosticResult>;
  passed: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class ApiService {
  private async post<T>(endpoint: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `Request failed (${response.status}). Please retry.`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (signal?.aborted) {
        throw new Error('Request stopped.');
      }
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Backend health check failed.');
      return await res.json();
    } catch {
      return { status: 'offline', aiConfigured: false, provider: null, model: null };
    }
  }

  async getAiConfiguration(): Promise<AiConfigurationStatus> {
    const response = await fetch('/api/ai/config');
    if (!response.ok) throw new Error('AI settings could not be loaded from the server.');
    return response.json();
  }

  async saveAiConfiguration(configuration: { provider: 'google'; model: string; apiKey?: string }) {
    const response = await fetch('/api/ai/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configuration),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || `AI settings could not be saved (${response.status}).`);
    return result as { configured: boolean; provider: string; model: string };
  }

  async removeAiConfiguration() {
    const response = await fetch('/api/ai/config', { method: 'DELETE' });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'AI settings could not be removed.');
  }

  async runAiDiagnostics(): Promise<AiDiagnostics> {
    return this.post<AiDiagnostics>('/api/ai/diagnostics', {});
  }

  async streamChat(messages: ChatMessage[], onText: (text: string) => void, signal: AbortSignal) {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || `Assistant request failed (${response.status}).`);
    }
    if (!response.body) throw new Error('Streaming is unavailable in this browser.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary).replace(/\r/g, '');
        buffer = buffer.slice(boundary + 2);
        const data = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
        if (data === '[DONE]') {
          finished = true;
          break;
        }
        if (data) {
          const parsed = JSON.parse(data) as { text?: string; error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) onText(parsed.text);
        }
        boundary = buffer.indexOf('\n\n');
      }
      if (done) finished = true;
    }
  }

  async generateNotes(
    content: string,
    topicTitle: string,
    style: NotesStyle
  ): Promise<GeneratedNotesResponse> {
    return this.post<GeneratedNotesResponse>('/api/ai/notes', {
      content,
      topicTitle,
      style,
    });
  }

  async explainConcept(
    concept: string,
    context: string,
    depth: 'beginner' | 'standard' | 'advanced' | 'step_by_step'
  ): Promise<ExplainResponse> {
    return this.post<ExplainResponse>('/api/ai/explain', {
      concept,
      context,
      depth,
    });
  }

  async askQuestion(
    materialContent: string,
    question: string
  ): Promise<GroundedAskResponse> {
    return this.post<GroundedAskResponse>('/api/ai/ask', {
      materialContent,
      question,
    });
  }

  async generateQuiz(
    materialContent: string,
    topicTitle: string,
    questionCount: number = 4,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    includeShortAnswer: boolean = false,
    targetConcept?: string
  ): Promise<Quiz> {
    return this.post<Quiz>('/api/ai/quiz', {
      materialContent,
      topicTitle,
      questionCount,
      difficulty,
      includeShortAnswer,
      targetConcept,
    });
  }

  async evaluateAnswer(
    question: string,
    expectedAnswer: string,
    studentAnswer: string,
    concept: string
  ): Promise<EvaluateAnswerResponse> {
    return this.post<EvaluateAnswerResponse>('/api/ai/evaluate-answer', {
      question,
      expectedAnswer,
      studentAnswer,
      concept,
    });
  }

}

export const api = new ApiService();
