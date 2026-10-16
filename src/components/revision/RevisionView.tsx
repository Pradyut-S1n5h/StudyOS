import React, { useState, useEffect } from 'react';
import {
  Repeat,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Award,
  Zap,
} from 'lucide-react';
import { Flashcard, SpacedTopic, QuizAttempt, Subject } from '../../types';
import { storage } from '../../services/storage';
import { StudyIntelligenceEngine } from '../../services/intelligence';

interface RevisionViewProps {
  onStartRetest: (concept: string) => void;
  initialConcept?: string;
}

export const RevisionView: React.FC<RevisionViewProps> = ({
  onStartRetest,
  initialConcept,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'flashcards' | 'missed'>('queue');
  const [topics, setTopics] = useState<SpacedTopic[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Flashcard review deck state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [flashcardsReviewedCount, setFlashcardsReviewedCount] = useState(0);

  // New Flashcard Modal
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');

  const loadAll = () => {
    const a = storage.getAttempts();
    const s = storage.getSubjects();
    const fc = storage.getFlashcards();
    setAttempts(a);
    setSubjects(s);
    setFlashcards(fc);

    const concs = StudyIntelligenceEngine.analyzeConcepts(a, s);
    setTopics(concs);

    if (s.length > 0 && !newSubjectId) {
      setNewSubjectId(s[0].id);
    }
  };

  useEffect(() => {
    loadAll();
    window.addEventListener('studyos_storage_change', loadAll);
    return () => window.removeEventListener('studyos_storage_change', loadAll);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Spaced repetition due items
  const dueTopics = topics.filter((t) => t.status === 'due_today' || t.status === 'overdue');
  const dueFlashcards = flashcards.filter((f) => f.nextReviewDate <= todayStr);
  const missedQuestions = StudyIntelligenceEngine.getMissedQuestionsHistory(attempts);

  // Filter flashcards for current deck
  const reviewDeck = dueFlashcards.length > 0 ? dueFlashcards : flashcards;
  const currentCard = reviewDeck[currentCardIndex];

  // Handle flashcard rating
  const handleRateCard = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    storage.updateFlashcardReview(currentCard.id, rating);
    setIsAnswerRevealed(false);
    setFlashcardsReviewedCount((prev) => prev + 1);

    if (currentCardIndex < reviewDeck.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setCurrentCardIndex(0);
    }
  };

  const handleCreateFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim() || !newSubjectId) return;

    storage.addFlashcard({
      front: newFront.trim(),
      back: newBack.trim(),
      concept: newConcept.trim() || 'General Recall',
      subjectId: newSubjectId,
    });

    setNewFront('');
    setNewBack('');
    setNewConcept('');
    setShowNewCardModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Revision Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic spaced repetition schedule (1d, 3d, 7d), active recall flashcards, and missed-question vault.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewCardModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Create Flashcard</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 text-xs font-semibold">
        {[
          {
            id: 'queue',
            label: 'Spaced Recall Queue',
            icon: Calendar,
            count: dueTopics.length,
          },
          {
            id: 'flashcards',
            label: 'Active Flashcards',
            icon: Layers,
            count: dueFlashcards.length,
          },
          {
            id: 'missed',
            label: 'Missed-Questions Vault',
            icon: AlertTriangle,
            count: missedQuestions.length,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-950/60 to-slate-900 text-amber-300 border border-amber-800/80 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SPACED RECALL QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Spaced Repetition Schedule
                </h3>
                <p className="text-xs text-slate-400">
                  Concepts missed repeatedly reset to 1-day intervals. Mastered concepts expand to 7-14 days.
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-amber-400">
                {dueTopics.length} due today
              </span>
            </div>
          </div>

          {topics.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
              <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">No concept history yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Complete a diagnostic quiz in Study Lab to calibrate your spaced repetition intervals.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((item) => {
                const isOverdue = item.status === 'overdue';
                const isDueToday = item.status === 'due_today';
                const isMastered = item.status === 'mastered';

                return (
                  <div
                    key={item.concept}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isOverdue
                        ? 'bg-rose-950/20 border-rose-900/50'
                        : isDueToday
                        ? 'bg-amber-950/20 border-amber-900/50'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{item.concept}</h4>
                        <span
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            isOverdue
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isDueToday
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : isMastered
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>Subject: {item.subjectName}</span>
                        <span>•</span>
                        <span>Measured Accuracy: {item.accuracy}%</span>
                        <span>•</span>
                        <span>Missed: {item.missedQuestionsCount} time(s)</span>
                        <span>•</span>
                        <span>Next Review: {item.nextReviewDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onStartRetest(item.concept)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Retest Concept</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE FLASHCARDS */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6">
          {reviewDeck.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">No flashcards created yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create flashcards with key formulas, definitions, and questions to start spaced recall drills.
              </p>
              <button
                onClick={() => setShowNewCardModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25"
              >
                Create First Flashcard
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
                <span>
                  Card {currentCardIndex + 1} of {reviewDeck.length}
                </span>
                <span className="font-mono text-cyan-400">
                  Concept: {currentCard.concept}
                </span>
              </div>

              {/* 3D Flashcard Canvas */}
              <div
                onClick={() => setIsAnswerRevealed(!isAnswerRevealed)}
                className="cursor-pointer min-h-[260px] p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 hover:border-slate-700 shadow-xl flex flex-col justify-between transition-all duration-300 relative group"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  <span>{isAnswerRevealed ? 'Answer & Explanation' : 'Recall Prompt'}</span>
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-cyan-400">
                    {isAnswerRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>Click to {isAnswerRevealed ? 'Hide' : 'Reveal'}</span>
                  </div>
                </div>

                <div className="py-6 text-center">
                  <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                    {isAnswerRevealed ? currentCard.back : currentCard.front}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-850">
                  <span>Interval: {currentCard.intervalDays} day(s)</span>
                  <span>Ease: {currentCard.easeFactor.toFixed(1)}x</span>
                </div>
              </div>

              {/* Spaced Repetition Grading Controls */}
              {isAnswerRevealed ? (
                <div className="pt-2 space-y-2">
                  <p className="text-center text-xs font-semibold text-slate-400">
                    How well did you recall this answer?
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleRateCard('again')}
                      className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-bold transition-all text-center"
                    >
                      <div>Again</div>
                      <div className="text-[10px] text-rose-400/80 font-normal mt-0.5">1 day</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('hard')}
                      className="p-3 rounded-xl bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800 text-amber-300 text-xs font-bold transition-all text-center"
                    >
                      <div>Hard</div>
                      <div className="text-[10px] text-amber-400/80 font-normal mt-0.5">2 days</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('good')}
                      className="p-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-800 text-indigo-300 text-xs font-bold transition-all text-center"
                    >
                      <div>Good</div>
                      <div className="text-[10px] text-indigo-400/80 font-normal mt-0.5">3-4 days</div>
                    </button>

                    <button
                      onClick={() => handleRateCard('easy')}
                      className="p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs font-bold transition-all text-center"
                    >
                      <div>Easy</div>
                      <div className="text-[10px] text-emerald-400/80 font-normal mt-0.5">7 days</div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setIsAnswerRevealed(true)}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                  >
                    Reveal Answer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MISSED QUESTIONS VAULT */}
      {activeTab === 'missed' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            Every question you answer incorrectly during diagnostic quizzes is archived here with its explanation so you can inspect recurring misconceptions.
          </div>

          {missedQuestions.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-200">No missed questions recorded</h3>
              <p className="text-xs text-slate-400 mt-1">
                You have a clean slate or haven't attempted any quizzes yet!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {missedQuestions.map((mq, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-100 leading-relaxed">
                        {mq.questionText}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="text-amber-400 font-semibold">{mq.concept}</span>
                        <span>•</span>
                        <span>From: {mq.quizTitle}</span>
                        <span>•</span>
                        <span>{new Date(mq.attemptDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onStartRetest(mq.concept)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                    >
                      Practice
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                    <div className="text-emerald-300 font-medium">
                      Correct Answer: {mq.correctAnswer}
                    </div>
                    <div className="text-slate-400 leading-relaxed pt-1">
                      {mq.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Flashcard Modal */}
      {showNewCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateFlashcard}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4"
          >
            <h3 className="font-bold text-base text-white">Create Active Recall Flashcard</h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Front Prompt / Question *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. What is the net ATP and NADPH requirement for one turn of the Calvin cycle?"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Back Answer / Explanation *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. 9 ATP and 6 NADPH per 3 CO2 fixed to yield 1 net G3P."
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label>
                <select
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Concept Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Calvin Stoichiometry"
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewCardModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
              >
                Save Flashcard
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
