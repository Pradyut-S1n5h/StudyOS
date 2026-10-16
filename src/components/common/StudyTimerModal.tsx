import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Check, Timer, Sparkles } from 'lucide-react';
import { storage } from '../../services/storage';
import { Subject } from '../../types';

interface StudyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (running: boolean) => void;
  timerSeconds: number;
  setTimerSeconds: React.Dispatch<React.SetStateAction<number>>;
  subjects: Subject[];
}

export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({
  isOpen,
  onClose,
  isTimerRunning,
  setIsTimerRunning,
  timerSeconds,
  setTimerSeconds,
  subjects,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const [sessionType, setSessionType] = useState<
    'reading' | 'notes_gen' | 'quiz' | 'flashcards' | 'revision' | 'custom_timer'
  >('reading');
  const [notes, setNotes] = useState('');
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  // Sync selectedSubject if empty
  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  if (!isOpen) return null;

  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleReset = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
  };

  const handleSaveSession = () => {
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    storage.addSession({
      subjectId: selectedSubjectId || (subjects[0]?.id ?? 'general'),
      durationMinutes: minutes,
      type: sessionType,
      notes: notes.trim() || undefined,
    });

    setCompletedMessage(`Logged ${minutes} minute(s) of focused study!`);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setNotes('');

    setTimeout(() => {
      setCompletedMessage(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-lg">Focus Study Session</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {completedMessage ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-emerald-300">{completedMessage}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Big Digital Clock */}
            <div className="text-center py-6 px-4 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner">
              <span className="text-5xl font-mono font-bold tracking-tight text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                {formatTime(timerSeconds)}
              </span>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                {isTimerRunning ? 'Session in progress...' : timerSeconds > 0 ? 'Paused' : 'Ready to begin'}
              </p>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggleTimer}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isTimerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Start Focus
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                disabled={timerSeconds === 0}
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Session Metadata Form */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Activity</label>
                  <select
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value as any)}
                    className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="reading">Deep Reading</option>
                    <option value="notes_gen">Notes Review</option>
                    <option value="quiz">Practice Quiz</option>
                    <option value="flashcards">Flashcard Recall</option>
                    <option value="revision">Targeted Revision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Session Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Covered Photosystem II and photolysis mechanisms"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveSession}
                disabled={timerSeconds < 10}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Log Completed Study ({Math.max(1, Math.round(timerSeconds / 60))} min)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
