export type Priority = 'high' | 'medium' | 'low';

export interface Subject {
  id: string;
  name: string;
  code?: string;
  color: string;
  icon: string;
  description: string;
  createdAt: string;
}

export interface Chapter {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  order: number;
}

export interface StudyMaterial {
  id: string;
  subjectId: string;
  chapterId?: string;
  title: string;
  content: string;
  sourceType: 'pasted' | 'uploaded_text' | 'uploaded_pdf' | 'notes';
  fileName?: string;
  characterCount: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudyTask {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  chapterId?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedMinutes: number;
  actualMinutesSpent: number;
  priority: Priority;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export type NotesStyle =
  | 'quick_revision'
  | 'detailed_explanation'
  | 'key_definitions'
  | 'formulas_concepts'
  | 'misconceptions';

export interface GeneratedNotes {
  id: string;
  materialId?: string;
  subjectId: string;
  chapterId?: string;
  title: string;
  style: NotesStyle;
  content: string; // Markdown formatted
  keyTakeaways: string[];
  definitions?: { term: string; definition: string }[];
  formulas?: { name: string; formula: string; note: string }[];
  createdAt: string;
}

export type QuestionType = 'mcq' | 'short_answer';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[]; // 4 options for MCQ
  correctAnswer: number; // 0-indexed option for MCQ
  expectedAnswer?: string; // for short answer
  explanation: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Quiz {
  id: string;
  materialId?: string;
  subjectId: string;
  chapterId?: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuestionAnswerRecord {
  questionId: string;
  questionText: string;
  type: QuestionType;
  concept: string;
  selectedOption?: number;
  textAnswer?: string;
  isCorrect: boolean;
  score: number; // 0 to 100
  feedback?: string;
  correctAnswerText: string;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  materialId?: string;
  subjectId: string;
  score: number; // e.g. 4
  totalQuestions: number;
  percentage: number; // 0-100
  answers: QuestionAnswerRecord[];
  timeSpentSeconds: number;
  completedAt: string;
  weakConceptsIdentified: string[];
}

export interface Flashcard {
  id: string;
  subjectId: string;
  chapterId?: string;
  materialId?: string;
  concept: string;
  front: string;
  back: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number; // default 2.5
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface SpacedTopic {
  concept: string;
  subjectId: string;
  subjectName: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  lastTestedAt: string;
  nextReviewDate: string;
  status: 'overdue' | 'due_today' | 'upcoming' | 'mastered';
  missedQuestionsCount: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
  type: 'reading' | 'notes_gen' | 'quiz' | 'flashcards' | 'revision' | 'custom_timer';
  notes?: string;
}

export interface StudyRecommendation {
  id: string;
  type: 'review_concept' | 'retake_quiz' | 'spaced_revision' | 'deadline_prep';
  title: string;
  reason: string;
  priority: 'urgent' | 'recommended' | 'optional';
  actionLabel: string;
  concept?: string;
  subjectId?: string;
  materialId?: string;
  quizId?: string;
  taskId?: string;
}

export interface StudyGoal {
  dailyMinutesTarget: number;
  weeklyQuizzesTarget: number;
}
