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

class ApiService {
  private async post<T>(endpoint: string, body: any): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

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
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch {
      return { status: 'offline', hasGeminiKey: false };
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
