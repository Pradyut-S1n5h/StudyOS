import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  AlertCircle,
  Calendar,
  Filter,
  Check,
  Brain,
  ArrowRight,
  ListFilter,
} from 'lucide-react';
import { StudyTask, Subject, Chapter, Priority } from '../../types';
import { storage } from '../../services/storage';
import { api, SmartPlanResponse } from '../../services/api';
import { StudyIntelligenceEngine } from '../../services/intelligence';

export const PlannerView: React.FC = () => {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Filters & Views
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Task creation modal
  const [showModal, setShowModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskChapterId, setTaskChapterId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [taskDueTime, setTaskDueTime] = useState('18:00');
  const [taskDuration, setTaskDuration] = useState(30);
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');

  // Smart Schedule Assistant Modal
  const [showSmartPlanModal, setShowSmartPlanModal] = useState(false);
  const [availableHours, setAvailableHours] = useState(2);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [smartPlanResult, setSmartPlanResult] = useState<SmartPlanResponse | null>(null);

  const loadData = () => {
    setTasks(storage.getTasks());
    setSubjects(storage.getSubjects());
    setChapters(storage.getChapters());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('studyos_storage_change', loadData);
    return () => window.removeEventListener('studyos_storage_change', loadData);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filtering
  const filteredTasks = tasks.filter((t) => {
    // Subject filter
    if (subjectFilter !== 'all' && t.subjectId !== subjectFilter) return false;
    // Priority filter
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    // Tab filter
    if (activeTab === 'today') {
      return !t.completed && t.dueDate === todayStr;
    }
    if (activeTab === 'upcoming') {
      return !t.completed && t.dueDate > todayStr;
    }
    if (activeTab === 'completed') {
      return t.completed;
    }
    return true;
  });

  const handleToggle = (id: string) => {
    storage.toggleTask(id);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this study task?')) {
      storage.deleteTask(id);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSubjectId) return;

    storage.addTask({
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      subjectId: taskSubjectId,
      chapterId: taskChapterId || undefined,
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
      estimatedMinutes: Number(taskDuration) || 30,
      priority: taskPriority,
      completed: false,
    });

    setTaskTitle('');
    setTaskDesc('');
    setShowModal(false);
  };

  // Trigger Smart Schedule Assistant
  const handleGenerateSmartPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const attempts = storage.getAttempts();
      const concs = StudyIntelligenceEngine.analyzeConcepts(attempts, subjects);
      const weakTopics = concs.filter((c) => c.accuracy < 70);
      const pendingTasks = tasks.filter((t) => !t.completed);

      const res = await api.generateSmartPlan(
        pendingTasks,
        weakTopics,
        availableHours,
        storage.getGoal()
      );
      setSmartPlanResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Study Planner</h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize study tasks, deadlines, and generate adaptive schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSmartPlanResult(null);
              setShowSmartPlanModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>AI Schedule Assistant</span>
          </button>

          <button
            onClick={() => {
              if (subjects.length > 0 && !taskSubjectId) {
                setTaskSubjectId(subjects[0].id);
              }
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Study Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'today', label: 'Due Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-3">
          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-300 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-300 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
          <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">No tasks in this view</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Add tasks with due dates to let the AI Schedule Assistant suggest an optimal revision timetable.
          </p>
          <button
            onClick={() => {
              if (subjects.length > 0 && !taskSubjectId) {
                setTaskSubjectId(subjects[0].id);
              }
              setShowModal(true);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25"
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const subj = subjects.find((s) => s.id === task.subjectId);
            const chap = chapters.find((c) => c.id === task.chapterId);
            const isDueToday = task.dueDate === todayStr;
            const isOverdue = !task.completed && task.dueDate < todayStr;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  task.completed
                    ? 'bg-slate-950/40 border-slate-850 opacity-70'
                    : isOverdue
                    ? 'bg-rose-950/20 border-rose-900/50'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    onClick={() => handleToggle(task.id)}
                    className="mt-0.5 text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {task.title}
                      </h3>

                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          task.priority === 'high'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                            : task.priority === 'medium'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {task.priority}
                      </span>

                      {isDueToday && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                          Due Today
                        </span>
                      )}

                      {isOverdue && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50">
                          Overdue
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      {subj && (
                        <span className="font-medium" style={{ color: subj.color }}>
                          {subj.name}
                        </span>
                      )}
                      {chap && <span>• {chap.title}</span>}
                      <span>• Due: {task.dueDate} {task.dueTime || ''}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.estimatedMinutes} min
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-850"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4"
          >
            <h3 className="font-bold text-base text-white">Create Study Task</h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Task Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Review Calvin Cycle 3 Phases & RuBisCO"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description / Objectives
              </label>
              <textarea
                rows={2}
                placeholder="What specific problems or topics will you cover?"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label>
                <select
                  required
                  value={taskSubjectId}
                  onChange={(e) => {
                    setTaskSubjectId(e.target.value);
                    setTaskChapterId('');
                  }}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chapter</label>
                <select
                  value={taskChapterId}
                  onChange={(e) => setTaskChapterId(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="">General</option>
                  {chapters
                    .filter((c) => c.subjectId === taskSubjectId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Estimated Mins</label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(Number(e.target.value))}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Priority)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Smart Schedule Assistant Modal */}
      {showSmartPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">
                  AI Smart Schedule Assistant
                </h3>
              </div>
              <button
                onClick={() => setShowSmartPlanModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Analyzes your pending tasks, deadlines, and weak concepts to formulate a balanced, sustainable daily timetable. (Note: A schedule assists planning, but mastery depends on practice and active recall).
            </p>

            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <label className="text-xs font-medium text-slate-300 whitespace-nowrap">
                Available study time today:
              </label>
              <select
                value={availableHours}
                onChange={(e) => setAvailableHours(Number(e.target.value))}
                className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-1.5 text-cyan-300 font-semibold"
              >
                <option value={1}>1 hour</option>
                <option value={1.5}>1.5 hours</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
                <option value={4}>4 hours</option>
              </select>

              <button
                onClick={handleGenerateSmartPlan}
                disabled={isGeneratingPlan}
                className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 shadow-sm"
              >
                {isGeneratingPlan ? 'Synthesizing Plan...' : 'Generate Timetable'}
              </button>
            </div>

            {smartPlanResult && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200 leading-relaxed">
                  <p className="font-semibold mb-1 text-indigo-300">Strategic Guidance:</p>
                  {smartPlanResult.scheduleAdvice}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recommended Blocks:
                  </h4>
                  {smartPlanResult.suggestedBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {block.time}
                        </span>
                        <span className="text-xs text-slate-200">{block.activity}</span>
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {block.focusType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
