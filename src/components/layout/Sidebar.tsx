import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  BrainCircuit,
  Repeat,
  BarChart3,
  Flame,
  Clock,
  Sparkles,
} from 'lucide-react';
import { storage } from '../../services/storage';
import { StudyIntelligenceEngine } from '../../services/intelligence';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const [dueRevisionCount, setDueRevisionCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [streakDays, setStreakDays] = useState(3);

  useEffect(() => {
    const updateCounts = () => {
      const attempts = storage.getAttempts();
      const flashcards = storage.getFlashcards();
      const subjects = storage.getSubjects();
      const tasks = storage.getTasks();
      const sessions = storage.getSessions();

      const todayStr = new Date().toISOString().split('T')[0];

      // Spaced repetition due
      const concepts = StudyIntelligenceEngine.analyzeConcepts(attempts, subjects);
      const dueConcepts = concepts.filter(
        (c) => c.status === 'due_today' || c.status === 'overdue'
      ).length;
      const dueFlashcards = flashcards.filter((f) => f.nextReviewDate <= todayStr).length;
      setDueRevisionCount(dueConcepts + dueFlashcards);

      // Tasks due soon
      const pending = tasks.filter((t) => !t.completed).length;
      setPendingTasksCount(pending);

      // Calculate streak from session dates
      const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort().reverse();
      setStreakDays(Math.max(1, uniqueDates.length));
    };

    updateCounts();
    window.addEventListener('studyos_storage_change', updateCounts);
    return () => window.removeEventListener('studyos_storage_change', updateCounts);
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      desc: 'Overview & intelligence feed',
    },
    {
      id: 'library',
      label: 'My Library',
      icon: BookOpen,
      badge: null,
      desc: 'Subjects, chapters & notes',
    },
    {
      id: 'planner',
      label: 'Study Planner',
      icon: CalendarCheck,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      desc: 'Deadlines & smart schedule',
    },
    {
      id: 'studylab',
      label: 'AI Study Lab',
      icon: BrainCircuit,
      badge: 'AI',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      desc: 'Notes, explanations & quizzes',
    },
    {
      id: 'revision',
      label: 'Revision Center',
      icon: Repeat,
      badge: dueRevisionCount > 0 ? dueRevisionCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      desc: 'Spaced recall & weak topics',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
      desc: 'Mastery & study velocity',
    },
  ];

  const handleSelect = (id: string) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:sticky top-16 z-30 flex flex-col justify-between h-[calc(100vh-4rem)] w-64 border-r border-slate-800/80 bg-slate-950/95 p-4 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Main Navigation List */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Operating System
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 text-cyan-300 border border-cyan-800/60 shadow-sm shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Engine Status Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold uppercase text-[10px] tracking-wider text-slate-400">
                Study Momentum
              </span>
              <div className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                <span>{streakDays}d Streak</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Study Intelligence Engine active. Tracking real quiz accuracy and spaced recall windows.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-900 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Local DB & AI Connected
          </span>
          <span className="font-mono text-[10px]">Gemini 3.8</span>
        </div>
      </aside>
    </>
  );
};
