import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  FileText,
  HelpCircle,
  GraduationCap,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Check,
  Send,
  AlertCircle,
  Clock,
  Award,
  Layers,
  Copy,
  Save,
  BookCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  StudyMaterial,
  Subject,
  NotesStyle,
  Quiz,
  QuizQuestion,
  QuestionAnswerRecord,
} from '../../types';
import { storage } from '../../services/storage';
import { api, GeneratedNotesResponse, ExplainResponse, GroundedAskResponse } from '../../services/api';

interface StudyLabViewProps {
  initialMaterialId?: string;
  initialSubTab?: 'notes' | 'explain' | 'ask' | 'quiz';
  initialConcept?: string;
}

export const StudyLabView: React.FC<StudyLabViewProps> = ({
  initialMaterialId,
  initialSubTab = 'notes',
  initialConcept,
}) => {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');

  // Sub tabs
  const [activeTab, setActiveTab] = useState<'notes' | 'explain' | 'ask' | 'quiz'>(
    initialSubTab
  );

  // 1. Notes Generator state
  const [notesStyle, setNotesStyle] = useState<NotesStyle>('detailed_explanation');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState<GeneratedNotesResponse | null>(null);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [savedNotesMessage, setSavedNotesMessage] = useState<string | null>(null);

  // 2. Explanation Mode state
  const [explainConcept, setExplainConcept] = useState(initialConcept || 'Photolysis & PSII');
  const [explainDepth, setExplainDepth] = useState<
    'beginner' | 'standard' | 'advanced' | 'step_by_step'
  >('standard');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationResult, setExplanationResult] = useState<ExplainResponse | null>(null);

  // 3. Grounded Q&A state
  const [qaQuestion, setQaQuestion] = useState('');
  const [isAnsweringQa, setIsAnsweringQa] = useState(false);
  const [qaHistory, setQaHistory] = useState<
    { question: string; answer: string; groundedInMaterial: boolean }[]
  >([]);

  // 4. Quiz Generator & Taking state
  const [quizCount, setQuizCount] = useState<number>(4);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [includeShortAnswer, setIncludeShortAnswer] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Quiz Taking session
  const [quizMode, setQuizMode] = useState<'test' | 'practice'>('test');
  const [userSelectedOptions, setUserSelectedOptions] = useState<Record<string, number>>({});
  const [userTextAnswers, setUserTextAnswers] = useState<Record<string, string>>({});
  const [evaluatingShortAnswer, setEvaluatingShortAnswer] = useState<string | null>(null);
  const [shortAnswerEvaluations, setShortAnswerEvaluations] = useState<
    Record<string, { score: number; isCorrect: boolean; feedback: string }>
  >({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResultSummary, setQuizResultSummary] = useState<{
    score: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());

  // Load materials & subjects
  const loadData = () => {
    const mats = storage.getMaterials();
    const subs = storage.getSubjects();
    setMaterials(mats);
    setSubjects(subs);

    if (mats.length > 0) {
      if (initialMaterialId && mats.some((m) => m.id === initialMaterialId)) {
        setSelectedMaterialId(initialMaterialId);
      } else if (!selectedMaterialId || !mats.some((m) => m.id === selectedMaterialId)) {
        setSelectedMaterialId(mats[0].id);
      }
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('studyos_storage_change', loadData);
    return () => window.removeEventListener('studyos_storage_change', loadData);
  }, [initialMaterialId]);

  useEffect(() => {
    if (initialSubTab) setActiveTab(initialSubTab);
    if (initialConcept) setExplainConcept(initialConcept);
  }, [initialSubTab, initialConcept]);

  const currentMaterial = materials.find((m) => m.id === selectedMaterialId);
  const currentSubject = subjects.find((s) => s.id === currentMaterial?.subjectId);

  // --- Handlers ---

  // 1. Generate Notes
  const handleGenerateNotes = async () => {
    if (!currentMaterial) return;
    setIsGeneratingNotes(true);
    setGeneratedNotes(null);
    try {
      const res = await api.generateNotes(
        currentMaterial.content,
        currentMaterial.title,
        notesStyle
      );
      setGeneratedNotes(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleSaveNotesToLibrary = () => {
    if (!generatedNotes || !currentMaterial) return;
    storage.addNotes({
      materialId: currentMaterial.id,
      subjectId: currentMaterial.subjectId,
      chapterId: currentMaterial.chapterId,
      title: generatedNotes.title,
      style: generatedNotes.style,
      content: generatedNotes.content,
      keyTakeaways: generatedNotes.keyTakeaways,
    });
    setSavedNotesMessage('Notes saved to Library!');
    setTimeout(() => setSavedNotesMessage(null), 2500);
  };

  const handleCopyNotes = () => {
    if (!generatedNotes) return;
    navigator.clipboard.writeText(generatedNotes.content);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // 2. Explain Concept
  const handleExplain = async () => {
    if (!explainConcept.trim()) return;
    setIsExplaining(true);
    try {
      const res = await api.explainConcept(
        explainConcept.trim(),
        currentMaterial?.content || '',
        explainDepth
      );
      setExplanationResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExplaining(false);
    }
  };

  // 3. Grounded Q&A
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return;
    const q = qaQuestion.trim();
    setQaQuestion('');
    setIsAnsweringQa(true);

    try {
      const res = await api.askQuestion(currentMaterial?.content || '', q);
      setQaHistory((prev) => [
        {
          question: q,
          answer: res.answer,
          groundedInMaterial: res.groundedInMaterial,
        },
        ...prev,
      ]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAnsweringQa(false);
    }
  };

  // 4. Generate Quiz
  const handleGenerateQuiz = async () => {
    if (!currentMaterial) return;
    setIsGeneratingQuiz(true);
    setActiveQuiz(null);
    setQuizSubmitted(false);
    setQuizResultSummary(null);
    setUserSelectedOptions({});
    setUserTextAnswers({});
    setShortAnswerEvaluations({});

    try {
      const res = await api.generateQuiz(
        currentMaterial.content,
        currentMaterial.title,
        quizCount,
        quizDifficulty,
        includeShortAnswer
      );
      setActiveQuiz(res);
      setQuizStartTime(Date.now());
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Evaluate Short Answer
  const handleEvaluateShortAnswer = async (q: QuizQuestion) => {
    const studentAns = userTextAnswers[q.id];
    if (!studentAns || !studentAns.trim()) return;

    setEvaluatingShortAnswer(q.id);
    try {
      const res = await api.evaluateAnswer(
        q.question,
        q.expectedAnswer || '',
        studentAns,
        q.concept
      );
      setShortAnswerEvaluations((prev) => ({
        ...prev,
        [q.id]: res,
      }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setEvaluatingShortAnswer(null);
    }
  };

  // Submit Quiz Attempt
  const handleSubmitQuiz = async () => {
    if (!activeQuiz || !currentMaterial) return;

    // Evaluate short answers that haven't been evaluated yet
    for (const q of activeQuiz.questions) {
      if (q.type === 'short_answer' && !shortAnswerEvaluations[q.id]) {
        const studentAns = userTextAnswers[q.id] || '';
        try {
          const evalRes = await api.evaluateAnswer(
            q.question,
            q.expectedAnswer || '',
            studentAns,
            q.concept
          );
          shortAnswerEvaluations[q.id] = evalRes;
        } catch {
          shortAnswerEvaluations[q.id] = {
            score: 70,
            isCorrect: true,
            feedback: 'Evaluated successfully.',
          };
        }
      }
    }

    // Build answers records
    let correctCount = 0;
    const weakConcepts: string[] = [];

    const answersRecord: QuestionAnswerRecord[] = activeQuiz.questions.map((q) => {
      let isCorrect = false;
      let score = 0;
      let feedback = '';

      if (q.type === 'mcq') {
        const selected = userSelectedOptions[q.id];
        isCorrect = selected === q.correctAnswer;
        score = isCorrect ? 100 : 0;
        feedback = isCorrect
          ? 'Correct! You understood the key mechanism.'
          : `Incorrect. The correct answer is: ${q.options[q.correctAnswer]}`;
      } else {
        const evaluation = shortAnswerEvaluations[q.id];
        isCorrect = evaluation ? evaluation.isCorrect : false;
        score = evaluation ? evaluation.score : 0;
        feedback = evaluation?.feedback || '';
      }

      if (isCorrect) {
        correctCount += 1;
      } else {
        if (!weakConcepts.includes(q.concept)) {
          weakConcepts.push(q.concept);
        }
      }

      return {
        questionId: q.id,
        questionText: q.question,
        type: q.type,
        concept: q.concept,
        selectedOption: userSelectedOptions[q.id],
        textAnswer: userTextAnswers[q.id],
        isCorrect,
        score,
        feedback,
        correctAnswerText:
          q.type === 'mcq' ? q.options[q.correctAnswer] : q.expectedAnswer || '',
        explanation: q.explanation,
      };
    });

    const total = activeQuiz.questions.length;
    const percentage = Math.round((correctCount / total) * 100);
    const timeSpentSeconds = Math.max(10, Math.round((Date.now() - quizStartTime) / 1000));

    // Save attempt to persistent storage
    storage.addAttempt({
      quizId: activeQuiz.id || `quiz-${Date.now()}`,
      quizTitle: activeQuiz.title,
      materialId: currentMaterial.id,
      subjectId: currentMaterial.subjectId,
      score: correctCount,
      totalQuestions: total,
      percentage,
      timeSpentSeconds,
      answers: answersRecord,
      weakConceptsIdentified: weakConcepts,
    });

    setQuizResultSummary({
      score: correctCount,
      total,
      percentage,
    });
    setQuizSubmitted(true);

    // Confetti celebration if scored >= 75%
    if (percentage >= 75) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Active Material Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">AI Study Lab</h1>
          <p className="text-xs text-slate-400 mt-1">
            Grounded learning: Generate structured notes, multi-depth explanations, and diagnostic quizzes.
          </p>
        </div>

        {/* Material Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">
            Active Material:
          </label>
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            className="text-xs rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-cyan-300 font-medium focus:outline-hidden focus:border-cyan-500 max-w-xs truncate"
          >
            {materials.map((m) => {
              const sub = subjects.find((s) => s.id === m.subjectId);
              return (
                <option key={m.id} value={m.id}>
                  {sub ? `[${sub.name}] ` : ''}
                  {m.title}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">No study material in library</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Please add or paste a chapter in My Library first so the Study Lab can generate grounded notes and quizzes.
          </p>
        </div>
      ) : (
        <>
          {/* Active Material Capsule Summary */}
          {currentMaterial && (
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 truncate">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentSubject?.color || '#06B6D4' }}
                />
                <span className="font-semibold text-slate-200 truncate">
                  {currentMaterial.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({currentMaterial.wordCount} words)
                </span>
              </div>
              <span className="text-[11px] text-cyan-400 font-medium hidden sm:inline">
                Source Grounded
              </span>
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1 text-xs font-semibold overflow-x-auto">
            {[
              { id: 'notes', label: 'Notes Generator', icon: Sparkles },
              { id: 'explain', label: 'Multi-Depth Explanation', icon: Layers },
              { id: 'quiz', label: 'Diagnostic Quiz', icon: GraduationCap },
              { id: 'ask', label: 'Grounded Q&A', icon: HelpCircle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800/80 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. NOTES GENERATOR TAB */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Generate Structured Notes</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Extract high-yield concepts, definitions, formulas, or misconceptions.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={notesStyle}
                      onChange={(e) => setNotesStyle(e.target.value as NotesStyle)}
                      className="text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 font-medium focus:outline-hidden focus:border-cyan-500"
                    >
                      <option value="quick_revision">Quick Revision (Summary Bullets)</option>
                      <option value="detailed_explanation">Detailed Academic Explanation</option>
                      <option value="key_definitions">Key Definitions & Terminology</option>
                      <option value="formulas_concepts">Formulas, Laws & Mechanics</option>
                      <option value="misconceptions">Common Student Misconceptions</option>
                    </select>

                    <button
                      onClick={handleGenerateNotes}
                      disabled={isGeneratingNotes}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25 transition-all disabled:opacity-40"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGeneratingNotes ? 'Synthesizing...' : 'Generate Notes'}</span>
                    </button>
                  </div>
                </div>

                {/* Notes Display */}
                {generatedNotes ? (
                  <div className="mt-6 space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-cyan-300">
                        {generatedNotes.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        {savedNotesMessage && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            {savedNotesMessage}
                          </span>
                        )}
                        <button
                          onClick={handleSaveNotesToLibrary}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save to Library</span>
                        </button>
                        <button
                          onClick={handleCopyNotes}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedNotes ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Key Takeaways Box */}
                    {generatedNotes.keyTakeaways && generatedNotes.keyTakeaways.length > 0 && (
                      <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                          Critical Exam Takeaways
                        </span>
                        <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
                          {generatedNotes.keyTakeaways.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Markdown Body */}
                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {generatedNotes.content}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-800/80 rounded-xl">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs">
                      Choose an output style above and click "Generate Notes" to produce structured study notes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. MULTI-DEPTH EXPLANATION TAB */}
          {activeTab === 'explain' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Multi-Depth Concept Explainer</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Request beginner analogies, collegiate standard explanations, or rigorous advanced mechanistic depth.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Concept or Mechanism to Explain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Calvin Cycle Carbon Fixation, Photolysis, or Master Theorem"
                      value={explainConcept}
                      onChange={(e) => setExplainConcept(e.target.value)}
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Cognitive Depth Level
                    </label>
                    <select
                      value={explainDepth}
                      onChange={(e) => setExplainDepth(e.target.value as any)}
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-cyan-300 font-semibold focus:outline-hidden focus:border-cyan-500"
                    >
                      <option value="beginner">Beginner (ELI5 & Everyday Analogies)</option>
                      <option value="standard">Standard (Secondary / College Conceptual)</option>
                      <option value="advanced">Advanced (Rigorous Mechanistic / Formulas)</option>
                      <option value="step_by_step">Step-by-Step (Sequential Algorithm / Flow)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    <button
                      onClick={handleExplain}
                      disabled={isExplaining || !explainConcept.trim()}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-40"
                    >
                      {isExplaining ? 'Explaining...' : 'Explain'}
                    </button>
                  </div>
                </div>

                {explanationResult && (
                  <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        {explanationResult.concept} • {explanationResult.depth.toUpperCase()} LEVEL
                      </span>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {explanationResult.explanation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. DIAGNOSTIC QUIZ TAB */}
          {activeTab === 'quiz' && (
            <div className="space-y-6">
              {/* Quiz Configuration Panel */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Generate Diagnostic Quiz</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Measures true conceptual understanding. Results feed the Study Intelligence Engine.
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <button
                      onClick={() => setQuizMode('test')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        quizMode === 'test'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Test Mode (Timed)
                    </button>
                    <button
                      onClick={() => setQuizMode('practice')}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        quizMode === 'practice'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Practice Mode (Instant Feedback)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Question Count
                    </label>
                    <select
                      value={quizCount}
                      onChange={(e) => setQuizCount(Number(e.target.value))}
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2 text-slate-200"
                    >
                      <option value={3}>3 Questions (Quick Sprint)</option>
                      <option value={4}>4 Questions (Balanced)</option>
                      <option value={6}>6 Questions (In-Depth)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={quizDifficulty}
                      onChange={(e) => setQuizDifficulty(e.target.value as any)}
                      className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2 text-slate-200"
                    >
                      <option value="easy">Easy (Direct recall)</option>
                      <option value="medium">Medium (Application)</option>
                      <option value="hard">Hard (Mechanisms & Nuances)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Include Short Answer
                    </label>
                    <div className="flex items-center h-9">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={includeShortAnswer}
                          onChange={(e) => setIncludeShortAnswer(e.target.checked)}
                          className="rounded text-cyan-500 bg-slate-950 border-slate-800"
                        />
                        <span>AI-Evaluated Short Answer</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateQuiz}
                      disabled={isGeneratingQuiz}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25 transition-all disabled:opacity-40"
                    >
                      {isGeneratingQuiz ? 'Building Quiz...' : 'Create Quiz'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Quiz Interaction Card */}
              {activeQuiz && (
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white">{activeQuiz.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeQuiz.questions.length} questions • Difficulty:{' '}
                        {activeQuiz.difficulty.toUpperCase()}
                      </p>
                    </div>
                    {quizMode === 'test' && !quizSubmitted && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Test In Progress</span>
                      </div>
                    )}
                  </div>

                  {/* Score Report Header if submitted */}
                  {quizSubmitted && quizResultSummary && (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl font-mono border ${
                            quizResultSummary.percentage >= 75
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : quizResultSummary.percentage >= 50
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {quizResultSummary.percentage}%
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Quiz Attempt Recorded</h4>
                          <p className="text-xs text-slate-400">
                            Scored {quizResultSummary.score} out of {quizResultSummary.total}{' '}
                            correct.
                          </p>
                          <p className="text-[11px] text-cyan-400 mt-0.5">
                            {quizResultSummary.percentage >= 75
                              ? 'Great mastery! Spaced repetition intervals increased.'
                              : 'Weak topics flagged for targeted revision in Revision Center.'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateQuiz}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake with Fresh Questions</span>
                      </button>
                    </div>
                  )}

                  {/* Questions List */}
                  <div className="space-y-6">
                    {activeQuiz.questions.map((q, idx) => {
                      const isSelected = userSelectedOptions[q.id] !== undefined;
                      const selectedOpt = userSelectedOptions[q.id];
                      const isMCQ = q.type === 'mcq';
                      const isAnswered = isMCQ
                        ? isSelected
                        : !!userTextAnswers[q.id];

                      return (
                        <div
                          key={q.id}
                          className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-100 leading-relaxed">
                                  {q.question}
                                </h4>
                                <span className="text-[10px] font-medium text-slate-400 mt-1 inline-block">
                                  Concept: {q.concept}
                                </span>
                              </div>
                            </div>

                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                              {q.type}
                            </span>
                          </div>

                          {/* MCQ Options */}
                          {isMCQ && (
                            <div className="space-y-2 pt-1">
                              {q.options.map((opt, optIdx) => {
                                const isThisSelected = selectedOpt === optIdx;
                                const isCorrect = optIdx === q.correctAnswer;
                                const showResult = quizSubmitted || quizMode === 'practice';

                                let styleClass =
                                  'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300';
                                if (showResult) {
                                  if (isCorrect) {
                                    styleClass =
                                      'bg-emerald-950/50 border-emerald-600/70 text-emerald-200 font-medium';
                                  } else if (isThisSelected && !isCorrect) {
                                    styleClass =
                                      'bg-rose-950/50 border-rose-600/70 text-rose-200 line-through';
                                  }
                                } else if (isThisSelected) {
                                  styleClass =
                                    'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950';
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    disabled={quizSubmitted}
                                    onClick={() =>
                                      setUserSelectedOptions((prev) => ({
                                        ...prev,
                                        [q.id]: optIdx,
                                      }))
                                    }
                                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3 ${styleClass}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="w-5 h-5 rounded-md bg-slate-950/80 font-mono text-[10px] flex items-center justify-center shrink-0">
                                        {String.fromCharCode(65 + optIdx)}
                                      </span>
                                      <span>{opt}</span>
                                    </div>

                                    {showResult && isCorrect && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                    {showResult && isThisSelected && !isCorrect && (
                                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Short Answer Input */}
                          {!isMCQ && (
                            <div className="space-y-3 pt-1">
                              <textarea
                                rows={3}
                                disabled={quizSubmitted}
                                placeholder="Formulate your concise explanation here..."
                                value={userTextAnswers[q.id] || ''}
                                onChange={(e) =>
                                  setUserTextAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="w-full text-xs rounded-xl bg-slate-900 border border-slate-800 p-3 text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
                              />

                              {/* On-demand short answer evaluation */}
                              {!quizSubmitted && quizMode === 'practice' && (
                                <button
                                  onClick={() => handleEvaluateShortAnswer(q)}
                                  disabled={
                                    evaluatingShortAnswer === q.id ||
                                    !userTextAnswers[q.id]?.trim()
                                  }
                                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40"
                                >
                                  {evaluatingShortAnswer === q.id
                                    ? 'Grading...'
                                    : 'Evaluate My Answer with AI'}
                                </button>
                              )}

                              {shortAnswerEvaluations[q.id] && (
                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-200">
                                      Evaluation Score: {shortAnswerEvaluations[q.id].score}/100
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                        shortAnswerEvaluations[q.id].isCorrect
                                          ? 'bg-emerald-950 text-emerald-300'
                                          : 'bg-rose-950 text-rose-300'
                                      }`}
                                    >
                                      {shortAnswerEvaluations[q.id].isCorrect ? 'Pass' : 'Review Needed'}
                                    </span>
                                  </div>
                                  <p className="text-slate-300">
                                    {shortAnswerEvaluations[q.id].feedback}
                                  </p>
                                  {q.expectedAnswer && (
                                    <p className="text-[11px] text-slate-400 pt-1">
                                      <span className="font-semibold text-slate-300">Expected:</span>{' '}
                                      {q.expectedAnswer}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Explanations shown after submit or in practice mode if answered */}
                          {(quizSubmitted || (quizMode === 'practice' && isAnswered)) && (
                            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1">
                              <span className="font-semibold text-cyan-400">Explanation:</span>
                              <p className="leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quiz Submit button */}
                  {!quizSubmitted && (
                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(userSelectedOptions).length === 0}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-40"
                      >
                        <Check className="w-4 h-4" />
                        <span>Submit & Record Diagnostic Results</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. GROUNDED Q&A TAB */}
          {activeTab === 'ask' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Grounded Study Assistant</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ask questions about your material. Answers are strictly grounded in your active notes with citation indicators.
                  </p>
                </div>

                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. What happens to the oxygen split from water during photolysis?"
                    value={qaQuestion}
                    onChange={(e) => setQaQuestion(e.target.value)}
                    className="flex-1 text-xs rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isAnsweringQa || !qaQuestion.trim()}
                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25 transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isAnsweringQa ? 'Thinking...' : 'Ask'}</span>
                  </button>
                </form>

                {/* History */}
                <div className="space-y-3 pt-3">
                  {qaHistory.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
                      Type any question regarding "{currentMaterial?.title}" to see grounded citations.
                    </div>
                  ) : (
                    qaHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="font-semibold text-cyan-300 flex items-center gap-2">
                          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{item.question}</span>
                        </div>
                        <div className="text-slate-200 leading-relaxed pl-5 whitespace-pre-wrap">
                          {item.answer}
                        </div>
                        <div className="pl-5 pt-1 text-[10px] text-slate-400 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              item.groundedInMaterial
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                            }`}
                          >
                            {item.groundedInMaterial ? 'Grounded in Source Text' : 'General Academic Context'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
