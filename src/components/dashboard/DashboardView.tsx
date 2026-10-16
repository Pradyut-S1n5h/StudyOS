import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  CalendarCheck,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Brain,
  Repeat,
  Plus,
  BookOpen,
  Award,
  Zap,
} from 'lucide-react';
import {
  Subject,
  StudyTask,
  QuizAttempt,
  StudySession,
  StudyRecommendation,
  SpacedTopic,
} from '../../types';
import { storage } from '../../services/storage';
import { StudyIntelligenceEngine } from '../../services/intelligence';

interface DashboardViewProps {
  onNavigate: (tab: string, params?: any) => void;
  onOpenTimer: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenTimer,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [concepts, setConcepts] = useState<SpacedTopic[]>([]);

  const loadData = () => {
    const s = storage.getSubjects();
    const t = storage.getTasks();
    const a = storage.getAttempts();
    const sess = storage.getSessions();
    const mats = storage.getMaterials();
    const flashcards = storage.getFlashcards();

    setSubjects(s);
    setTasks(t);
    setAttempts(a);
    setSessions(sess);

    const recs = StudyIntelligenceEngine.generateRecommendations(a, t, flashcards, mats, s);
    setRecommendations(recs);

    const concs = StudyIntelligenceEngine.analyzeConcepts(a, s);
    setConcepts(concs);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('studyos_storage_change', loadData);
    return () => window.removeEventListener('studyos_storage_change', loadData);
  }, []);

  const handleToggleTask = (taskId: string) => {
    storage.toggleTask(taskId);
  };

  const handleApplyRecommendation = (rec: StudyRecommendation) => {
    if (rec.type === 'review_concept') {
      onNavigate('studylab', {
        subTab: 'explain',
        concept: rec.concept,
        materialId: rec.materialId,
      });
    } else if (rec.type === 'spaced_revision') {
      onNavigate('revision', { concept: rec.concept });
    } else if (rec.type === 'retake_quiz') {
      onNavigate('studylab', {
        subTab: 'quiz',
        materialId: rec.materialId,
      });
    } else if (rec.type === 'deadline_prep') {
      onNavigate('planner');
    }
  };

  // Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMinutes = sessions
    .filter((s) => s.date === todayStr)
    .reduce((acc, curr) => acc + curr.durationMinutes, 0);

  const goal = storage.getGoal();
  const completedTasksToday = tasks.filter(
    (t) => t.completed && t.completedAt && t.completedAt.startsWith(todayStr)
  ).length;

  const pendingUrgentTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  // Compute 7-day session activity bars
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const mins = sessions
      .filter((s) => s.date === dateStr)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    return { dateStr, dayName, mins };
  });

  const maxMins = Math.max(...last7Days.map((d) => d.mins), 60);

  // Recent quiz attempts (last 3)
  const recentAttempts = attempts.slice(0, 3);

  // Weak concepts list
  const weakConcepts = concepts.filter((c) => c.accuracy < 70).slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Study Intelligence Engine Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back to StudyOS
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your materials, active recall schedules, and weak topics are synchronized. You have{' '}
              <span className="text-cyan-400 font-semibold">{pendingUrgentTasks.length} pending task(s)</span> and{' '}
              <span className="text-amber-400 font-semibold">
                {recommendations.filter((r) => r.priority === 'urgent').length} urgent recommendation(s)
              </span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('studylab')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Study Session</span>
            </button>
            <button
              onClick={onOpenTimer}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-all cursor-pointer"
            >
              <span>Timer Focus</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle glow background */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Today's Study</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{todayMinutes}m</span>
            <span className="text-xs text-slate-400">/ {goal.dailyMinutesTarget}m target</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((todayMinutes / goal.dailyMinutesTarget) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Tasks Done</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {tasks.filter((t) => t.completed).length}
            </span>
            <span className="text-xs text-slate-400">/ {tasks.length} total</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            {completedTasksToday} completed today
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Quiz Accuracy</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {attempts.length > 0
                ? Math.round(
                    attempts.reduce((acc, a) => acc + a.percentage, 0) / attempts.length
                  )
                : 0}
              %
            </span>
            <span className="text-xs text-slate-400">({attempts.length} attempts)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Grounded in real quiz scores
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Weak Topics</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {weakConcepts.length}
            </span>
            <span className="text-xs text-slate-400">identified</span>
          </div>
          <p className="text-[11px] text-amber-400/90 mt-3">
            {weakConcepts.length > 0 ? 'Targeted revision queued' : 'All tested topics on track'}
          </p>
        </div>
      </div>

      {/* Main Grid: Recommendations & Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Study Intelligence Engine Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">
                  Study Intelligence Recommendations
                </h2>
              </div>
              <span className="text-xs text-slate-400">Real-time adaptive queue</span>
            </div>

            {recommendations.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl p-6">
                <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-300">No pending recommendations</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Add study materials or take a quiz to let the engine detect your strengths and weak topics.
                </p>
                <button
                  onClick={() => onNavigate('library')}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  Go to Library
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      rec.priority === 'urgent'
                        ? 'bg-rose-950/20 border-rose-900/50 hover:border-rose-700/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            rec.priority === 'urgent'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {rec.priority}
                        </span>
                        <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{rec.reason}</p>
                    </div>

                    <button
                      onClick={() => handleApplyRecommendation(rec)}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-600/90 hover:bg-cyan-500 text-white shadow-sm transition-all"
                    >
                      <span>{rec.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Activity Chart */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-white">Weekly Focus Velocity</h2>
                <p className="text-xs text-slate-400">Actual measured study minutes (last 7 days)</p>
              </div>
              <span className="text-xs font-mono text-cyan-400 font-semibold">
                {last7Days.reduce((a, b) => a + b.mins, 0)} total mins
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pt-4">
              {last7Days.map((day) => {
                const heightPct = Math.max(8, Math.round((day.mins / maxMins) * 100));
                const isToday = day.dateStr === todayStr;
                return (
                  <div key={day.dateStr} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[10px] font-mono text-slate-400">
                      {day.mins > 0 ? `${day.mins}m` : '-'}
                    </span>
                    <div className="w-full bg-slate-800/60 rounded-lg overflow-hidden h-28 flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          isToday
                            ? 'bg-gradient-to-t from-cyan-600 to-indigo-500'
                            : 'bg-gradient-to-t from-slate-700 to-slate-600'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isToday ? 'text-cyan-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Today's Tasks & Weak Topics */}
        <div className="space-y-6">
          {/* Priority Tasks */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Upcoming Tasks</h2>
              </div>
              <button
                onClick={() => onNavigate('planner')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all
              </button>
            </div>

            {pendingUrgentTasks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-1 opacity-80" />
                <p className="text-xs">No pending tasks!</p>
                <button
                  onClick={() => onNavigate('planner')}
                  className="mt-3 text-xs text-indigo-400 hover:underline"
                >
                  Create a study task
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingUrgentTasks.map((t) => {
                  const subj = subjects.find((s) => s.id === t.subjectId);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex items-start gap-3"
                    >
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className="mt-0.5 text-slate-500 hover:text-cyan-400 transition-colors"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={`text-xs font-semibold truncate ${
                              t.completed ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {t.title}
                          </p>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                              t.priority === 'high'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          {subj && <span style={{ color: subj.color }}>{subj.name}</span>}
                          <span>•</span>
                          <span>{t.dueDate || 'No due date'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weak Topics Spotlight */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Concepts Needing Focus</h2>
              </div>
              <button
                onClick={() => onNavigate('revision')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Revision Center
              </button>
            </div>

            {weakConcepts.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <p className="text-xs">All measured quiz concepts are ≥ 70% accuracy.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {weakConcepts.map((wc) => (
                  <div
                    key={wc.concept}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{wc.concept}</p>
                      <p className="text-[11px] text-slate-400">
                        {wc.subjectName} • {wc.missedQuestionsCount} mistake(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-rose-400">
                        {wc.accuracy}%
                      </span>
                      <p className="text-[9px] uppercase tracking-wider text-slate-400">
                        Accuracy
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Subjects List */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Active Subjects</h2>
              </div>
              <button
                onClick={() => onNavigate('library')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Manage
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-xs">
                No subjects yet.{' '}
                <button
                  onClick={() => onNavigate('library')}
                  className="text-cyan-400 hover:underline"
                >
                  Create one now.
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {subjects.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => onNavigate('library', { subjectId: sub.id })}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                          {sub.name}
                        </span>
                        {sub.code && (
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                            {sub.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
