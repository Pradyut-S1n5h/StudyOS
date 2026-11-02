import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Timer,
  Play,
  RotateCcw,
  CheckCircle,
  Database,
  Download,
  Flame,
  Upload,
  Menu,
  X,
  Target,
} from 'lucide-react';
import { storage } from '../../services/storage';
import { localDateString } from '../../services/dates';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenTimer: () => void;
  isTimerRunning: boolean;
  timerSeconds: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenTimer,
  isTimerRunning,
  timerSeconds,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const [sessions, setSessions] = useState(() => storage.getSessions());
  const [goal, setGoal] = useState(() => storage.getGoal());
  const [showDataModal, setShowDataModal] = useState(false);
  const [importPayload, setImportPayload] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setSessions(storage.getSessions());
      setGoal(storage.getGoal());
    };
    window.addEventListener('studyos_storage_change', handleUpdate);
    return () => window.removeEventListener('studyos_storage_change', handleUpdate);
  }, []);

  const todayStr = localDateString();
  const todayMinutes = sessions
    .filter((s) => s.date === todayStr)
    .reduce((acc, curr) => acc + curr.durationMinutes, 0);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResetDefaults = () => {
    if (confirm('Load sample curriculum with AP Biology and Computer Science? Current custom changes will be replaced.')) {
      storage.resetToDefaults();
      setShowDataModal(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('Start completely fresh? This clears all existing subjects, tasks, and history to test empty states.')) {
      storage.clearAllData();
      setShowDataModal(false);
    }
  };

  const handleExportData = () => {
    const backup = new Blob([JSON.stringify(storage.exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(backup);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studyos-backup-${localDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDataMessage('Backup exported.');
    setDataError(null);
  };

  const handleSelectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setDataMessage(null);
    setDataError(null);
    setImportPayload(null);
    if (!file) return;
    if (file.size > 5_000_000) {
      setDataError('Backup files must be 5 MB or smaller.');
      return;
    }
    try {
      setImportPayload(await file.text());
      setImportFileName(file.name);
    } catch {
      setDataError('The selected backup could not be read.');
    }
  };

  const handleImportData = (mode: 'merge' | 'replace') => {
    if (!importPayload) return;
    if (mode === 'replace' && !confirm('Replace all current StudyOS data with this backup? This cannot be undone.')) return;
    const result = storage.importAll(importPayload, mode);
    if (!result.success) {
      setDataError(result.error || 'The backup could not be imported.');
      setDataMessage(null);
      return;
    }
    setDataMessage(mode === 'merge'
      ? `Imported ${importFileName}. Existing IDs were preserved (${result.preservedRecords || 0} matching records)${result.preservedGoal ? '; your current goal settings were kept' : ''}.`
      : `Replaced current data with ${importFileName}.`);
    setDataError(null);
    setImportPayload(null);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onTabChange('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  StudyOS
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  v2.0 AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Learn smarter. Plan better. Remember longer.
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Daily Goal Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Target className="w-4 h-4 text-emerald-400" />
            <div className="text-xs">
              <span className="text-slate-400">Today: </span>
              <span className="font-semibold text-slate-200">
                {todayMinutes}/{goal.dailyMinutesTarget}m
              </span>
            </div>
            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((todayMinutes / goal.dailyMinutesTarget) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Live Focus Timer Widget */}
          <button
            onClick={onOpenTimer}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isTimerRunning
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20 animate-pulse'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
            title="Open Focus Timer"
          >
            <Timer className={`w-4 h-4 ${isTimerRunning ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>{isTimerRunning ? formatTimer(timerSeconds) : 'Focus Timer'}</span>
          </button>

          {/* Quick Study Lab Launcher */}
          <button
            onClick={() => onTabChange('studylab')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-sm shadow-cyan-500/25 transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Study Lab</span>
            <span className="sm:hidden">Study</span>
          </button>

          {/* Data Manager (Load sample vs Fresh) */}
          <button
            onClick={() => {
              setDataMessage(null);
              setDataError(null);
              setShowDataModal(true);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700"
            title="Data & Sample Curriculum"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Data Management Dialog */}
      {showDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-lg">Curriculum & Data State</h3>
              </div>
              <button
                onClick={() => setShowDataModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              StudyOS uses a local, private persistent database. Switch between the rich sample curriculum (with pre-loaded AP Biology and CS topics) or start clean to test empty states.
            </p>

            <div className="mt-5 space-y-3">
              <button
                onClick={handleExportData}
                className="w-full flex items-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-100"
              >
                <Download className="h-4 w-4 text-cyan-400" /> Export JSON Backup
              </button>
              <label className="w-full flex items-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium text-slate-100 cursor-pointer">
                <Upload className="h-4 w-4 text-cyan-400" /> Import JSON Backup
                <input type="file" accept=".json,application/json" onChange={handleSelectImport} className="sr-only" />
              </label>
              {dataMessage && <p role="status" className="text-xs text-emerald-300">{dataMessage}</p>}
              {dataError && <p role="alert" className="text-xs text-rose-300">{dataError}</p>}
              {importPayload && (
                <div className="rounded-xl border border-cyan-900 bg-cyan-950/30 p-3 space-y-2">
                  <p className="text-xs text-slate-200">Ready to import {importFileName}.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleImportData('merge')} className="flex-1 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600">Merge new IDs</button>
                    <button onClick={() => handleImportData('replace')} className="flex-1 rounded-lg bg-rose-900 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-800">Replace all data</button>
                  </div>
                </div>
              )}
              <button
                onClick={handleResetDefaults}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition-all group"
              >
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" />
                    Load Sample Curriculum
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Includes sample AP Biology and CS materials, quiz attempts, and revision history.
                  </div>
                </div>
              </button>

              <button
                onClick={handleClearAll}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 text-left transition-all"
              >
                <div>
                  <div className="text-sm font-medium text-rose-300">Start Fresh (Empty State)</div>
                  <div className="text-xs text-rose-400/80 mt-0.5">
                    Clears all data so you can test adding new subjects, materials, and tasks from scratch.
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowDataModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
