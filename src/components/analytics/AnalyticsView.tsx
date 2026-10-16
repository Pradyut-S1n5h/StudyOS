import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Flame,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { QuizAttempt, StudySession, StudyTask, Subject, SpacedTopic } from '../../types';
import { storage } from '../../services/storage';
import { StudyIntelligenceEngine } from '../../services/intelligence';

export const AnalyticsView: React.FC = () => {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('7d');

  const loadData = () => {
    setAttempts(storage.getAttempts());
    setSessions(storage.getSessions());
    setTasks(storage.getTasks());
    setSubjects(storage.getSubjects());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('studyos_storage_change', loadData);
    return () => window.removeEventListener('studyos_storage_change', loadData);
  }, []);

  // Filter data by timeframe
  const now = Date.now();
  const filterByTime = (dateStr: string) => {
    const itemDate = new Date(dateStr).getTime();
    if (timeframe === '7d') return now - itemDate <= 7 * 86400000;
    if (timeframe === '30d') return now - itemDate <= 30 * 86400000;
    return true;
  };

  const filteredAttempts = attempts.filter((a) => filterByTime(a.completedAt));
  const filteredSessions = sessions.filter((s) => filterByTime(s.date));

  // Actual measured minutes vs estimated task duration
  const actualStudyMinutes = filteredSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const estimatedTaskMinutes = tasks
    .filter((t) => t.completed)
    .reduce((acc, t) => acc + t.estimatedMinutes, 0);

  // Overall accuracy
  const averageAccuracy =
    filteredAttempts.length > 0
      ? Math.round(
          filteredAttempts.reduce((acc, a) => acc + a.percentage, 0) /
            filteredAttempts.length
        )
      : 0;

  // Concepts analysis
  const concepts = StudyIntelligenceEngine.analyzeConcepts(attempts, subjects);
  const weakConcepts = concepts.filter((c) => c.accuracy < 70);
  const masteredConcepts = concepts.filter((c) => c.accuracy >= 90 && c.totalAttempts >= 2);

  // Subject-wise accuracy breakdown
  const subjectStats = subjects.map((subj) => {
    const subjAttempts = attempts.filter((a) => a.subjectId === subj.id);
    const subjAccuracy =
      subjAttempts.length > 0
        ? Math.round(
            subjAttempts.reduce((acc, a) => acc + a.percentage, 0) / subjAttempts.length
          )
        : null;
    const subjMinutes = sessions
      .filter((s) => s.subjectId === subj.id)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    const subjTasks = tasks.filter((t) => t.subjectId === subj.id);
    const subjTasksDone = subjTasks.filter((t) => t.completed).length;

    return {
      subject: subj,
      accuracy: subjAccuracy,
      minutes: subjMinutes,
      tasksTotal: subjTasks.length,
      tasksDone: subjTasksDone,
      attemptsCount: subjAttempts.length,
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Performance Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Grounded metrics from recorded study sessions and diagnostic quiz attempts.
          </p>
        </div>

        {/* Timeframe pill selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'all', label: 'All Time' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeframe(t.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                timeframe === t.id
                  ? 'bg-slate-800 text-cyan-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Actual Focus Time */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Recorded Study Time
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{actualStudyMinutes}m</span>
            <span className="text-xs text-slate-400">
              ({(actualStudyMinutes / 60).toFixed(1)} hrs)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Verified focus timer sessions
          </p>
        </div>

        {/* KPI 2: Measured Quiz Accuracy */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Quiz Accuracy
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{averageAccuracy}%</span>
            <span className="text-xs text-slate-400">
              ({filteredAttempts.length} quizzes)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Objective question score average
          </p>
        </div>

        {/* KPI 3: Task Completion Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tasks Completed
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {tasks.filter((t) => t.completed).length}
            </span>
            <span className="text-xs text-slate-400">/ {tasks.length}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {tasks.length > 0
              ? Math.round(
                  (tasks.filter((t) => t.completed).length / tasks.length) * 100
                )
              : 0}
            % completion rate
          </p>
        </div>

        {/* KPI 4: Mastery Ratio */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Mastered Concepts
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {masteredConcepts.length}
            </span>
            <span className="text-xs text-slate-400">/ {concepts.length} tested</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            ≥90% accuracy with ≥2 attempts
          </p>
        </div>
      </div>

      {/* Accuracy Over Time Graph */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Quiz Accuracy Trend</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Score percentages from chronologically ordered diagnostic quizzes
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            {filteredAttempts.length} recorded attempts
          </span>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
            No quiz attempts in this timeframe. Take a quiz in Study Lab to view accuracy trajectory.
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            {/* Simple responsive visual chart */}
            <div className="h-44 flex items-end gap-3 sm:gap-6 border-b border-slate-800 pb-2 px-2">
              {filteredAttempts.slice(-10).map((att, idx) => (
                <div
                  key={att.id}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <span className="text-[11px] font-mono font-bold text-cyan-400 opacity-80 group-hover:opacity-100">
                    {att.percentage}%
                  </span>
                  <div className="w-full bg-slate-800/80 rounded-t-lg overflow-hidden h-32 flex items-end">
                    <div
                      className={`w-full transition-all duration-500 ${
                        att.percentage >= 75
                          ? 'bg-gradient-to-t from-emerald-600 to-cyan-500'
                          : att.percentage >= 50
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                          : 'bg-gradient-to-t from-rose-600 to-rose-400'
                      }`}
                      style={{ height: `${Math.max(10, att.percentage)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[60px]">
                    {new Date(att.completedAt).toLocaleDateString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono px-2">
              <span>Earlier Quizzes</span>
              <span>Latest Attempt</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Columns: Subject-Wise Performance & Concepts Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Subject Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white">Subject-Wise Performance</h3>

          <div className="space-y-3">
            {subjectStats.map((item) => (
              <div
                key={item.subject.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.subject.color }}
                    />
                    <span className="text-xs font-semibold text-white">
                      {item.subject.name}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {item.accuracy !== null ? `${item.accuracy}% Accuracy` : 'Not yet tested'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: item.subject.color,
                      width: `${item.accuracy !== null ? item.accuracy : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Recorded Study: {item.minutes}m</span>
                  <span>
                    Tasks: {item.tasksDone}/{item.tasksTotal} done
                  </span>
                  <span>Quizzes: {item.attemptsCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Concepts Matrix & Weak Topic Spotlight */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Concepts Needing Attention</h3>
            <span className="text-xs text-amber-400 font-semibold">
              {weakConcepts.length} weak concept(s)
            </span>
          </div>

          {weakConcepts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
              No weak concepts detected. All measured concepts are performing above 70%!
            </div>
          ) : (
            <div className="space-y-3">
              {weakConcepts.map((wc) => (
                <div
                  key={wc.concept}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-200">
                      {wc.concept}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {wc.subjectName} • {wc.missedQuestionsCount} incorrect answer(s)
                    </div>
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

          {/* Mastered concepts summary pill */}
          {masteredConcepts.length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                Mastered Concepts ({masteredConcepts.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {masteredConcepts.map((mc) => (
                  <span
                    key={mc.concept}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-medium"
                  >
                    ✓ {mc.concept} ({mc.accuracy}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
