import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Search,
  Sparkles,
  ArrowRight,
  FolderPlus,
  Layers,
  Upload,
  Check,
  AlertCircle,
  HelpCircle,
  Edit2,
  Copy,
  BrainCircuit,
  GraduationCap,
} from 'lucide-react';
import { Subject, Chapter, StudyMaterial } from '../../types';
import { storage } from '../../services/storage';

interface LibraryViewProps {
  onNavigateToStudyLab: (materialId: string, action: 'notes' | 'quiz' | 'ask') => void;
  initialSubjectId?: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onNavigateToStudyLab,
  initialSubjectId,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Forms
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');
  const [subjectColor, setSubjectColor] = useState('#06B6D4');

  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDesc, setChapterDesc] = useState('');

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialContent, setMaterialContent] = useState('');
  const [materialChapterId, setMaterialChapterId] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const loadAll = () => {
    const s = storage.getSubjects();
    const c = storage.getChapters();
    const m = storage.getMaterials();
    setSubjects(s);
    setChapters(c);
    setMaterials(m);

    if (s.length > 0) {
      if (initialSubjectId && s.some((sub) => sub.id === initialSubjectId)) {
        setSelectedSubjectId(initialSubjectId);
      } else if (!selectedSubjectId || !s.some((sub) => sub.id === selectedSubjectId)) {
        setSelectedSubjectId(s[0].id);
      }
    } else {
      setSelectedSubjectId('');
      setSelectedMaterial(null);
    }
  };

  useEffect(() => {
    loadAll();
    window.addEventListener('studyos_storage_change', loadAll);
    return () => window.removeEventListener('studyos_storage_change', loadAll);
  }, [initialSubjectId]);

  // Set default selected material when subject changes
  useEffect(() => {
    if (selectedSubjectId) {
      const subjectMats = materials.filter((m) => m.subjectId === selectedSubjectId);
      if (subjectMats.length > 0 && (!selectedMaterial || selectedMaterial.subjectId !== selectedSubjectId)) {
        setSelectedMaterial(subjectMats[0]);
      } else if (subjectMats.length === 0) {
        setSelectedMaterial(null);
      }
    }
  }, [selectedSubjectId, materials]);

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);
  const activeChapters = chapters.filter((c) => c.subjectId === selectedSubjectId);

  // Filtered materials
  const filteredMaterials = materials.filter((m) => {
    const matchSubject = !selectedSubjectId || m.subjectId === selectedSubjectId;
    const matchSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchSearch;
  });

  // Handlers
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    const newSubj = storage.addSubject({
      name: subjectName.trim(),
      code: subjectCode.trim() || undefined,
      description: subjectDesc.trim(),
      color: subjectColor,
      icon: 'BookOpen',
    });

    setSelectedSubjectId(newSubj.id);
    setSubjectName('');
    setSubjectCode('');
    setSubjectDesc('');
    setShowSubjectModal(false);
  };

  const handleDeleteSubject = (id: string, name: string) => {
    if (confirm(`Delete subject "${name}" along with its chapters, tasks and materials?`)) {
      storage.deleteSubject(id);
    }
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterTitle.trim() || !selectedSubjectId) return;

    storage.addChapter({
      subjectId: selectedSubjectId,
      title: chapterTitle.trim(),
      description: chapterDesc.trim() || undefined,
      order: activeChapters.length + 1,
    });

    setChapterTitle('');
    setChapterDesc('');
    setShowChapterModal(false);
  };

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim() || !materialContent.trim() || !selectedSubjectId) return;

    const newMat = storage.addMaterial({
      subjectId: selectedSubjectId,
      chapterId: materialChapterId || undefined,
      title: materialTitle.trim(),
      content: materialContent.trim(),
      sourceType: 'pasted',
    });

    setSelectedMaterial(newMat);
    setMaterialTitle('');
    setMaterialContent('');
    setMaterialChapterId('');
    setShowMaterialModal(false);
  };

  const handleDeleteMaterial = (id: string) => {
    if (confirm('Delete this study material?')) {
      storage.deleteMaterial(id);
      if (selectedMaterial?.id === id) {
        setSelectedMaterial(null);
      }
    }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const fileName = file.name;
      const extension = fileName.split('.').pop()?.toLowerCase();

      if (extension === 'txt' || extension === 'md' || extension === 'json' || extension === 'csv') {
        const text = await file.text();
        setMaterialTitle(fileName.replace(/\.[^/.]+$/, ''));
        setMaterialContent(text);
      } else if (extension === 'pdf') {
        // PDF text extraction handling
        // Attempt basic text slice or inform user gracefully
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const raw = decoder.decode(buffer);
        // Extract printable strings
        const cleaned = raw.replace(/[^\x20-\x7E\t\n\r]/g, ' ');
        const matches = cleaned.match(/[A-Za-z0-9\s.,;:'"()\-?!]{15,}/g);

        if (matches && matches.join(' ').length > 200) {
          setMaterialTitle(fileName.replace(/\.[^/.]+$/, ''));
          setMaterialContent(matches.join('\n\n').slice(0, 15000));
        } else {
          setUploadError(
            'The selected PDF appears scanned or encrypted. For optimal accuracy, please copy and paste the chapter text directly.'
          );
        }
      } else {
        setUploadError(`File type ".${extension}" is unsupported. Please upload .txt, .md, or paste text.`);
      }
    } catch (err: any) {
      setUploadError(`Error reading document: ${err.message}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Library</h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize study subjects, chapters, source materials, and notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSubjectModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>New Subject</span>
          </button>

          <button
            onClick={() => {
              if (!selectedSubjectId && subjects.length > 0) {
                setSelectedSubjectId(subjects[0].id);
              }
              setShowMaterialModal(true);
            }}
            disabled={subjects.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25 transition-all disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            <span>Add Study Material</span>
          </button>
        </div>
      </div>

      {subjects.length === 0 ? (
        /* Empty state when no subjects exist */
        <div className="py-16 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 p-8">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Your library is empty</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Create your first subject (e.g. AP Biology, World History, or Computer Science) to start organizing your study material.
          </p>
          <button
            onClick={() => setShowSubjectModal(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/25"
          >
            Create First Subject
          </button>
        </div>
      ) : (
        /* Library 3-column browser */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[550px]">
          {/* Left Column: Subjects & Chapters (3 cols) */}
          <div className="md:col-span-3 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400 tracking-wider">
                <span>Subjects ({subjects.length})</span>
                <button
                  onClick={() => setShowSubjectModal(true)}
                  className="p-1 rounded text-cyan-400 hover:bg-slate-800"
                  title="Add Subject"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {subjects.map((sub) => {
                  const isSelected = sub.id === selectedSubjectId;
                  const count = materials.filter((m) => m.subjectId === sub.id).length;
                  return (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color }}
                        />
                        <span className="truncate">{sub.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {count}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubject(sub.id, sub.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 p-0.5 rounded transition-opacity"
                          title="Delete subject"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chapters card */}
            {activeSubject && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  <span>Chapters ({activeChapters.length})</span>
                  <button
                    onClick={() => setShowChapterModal(true)}
                    className="p-1 rounded text-cyan-400 hover:bg-slate-800"
                    title="Add Chapter"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activeChapters.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No chapters created yet.</p>
                ) : (
                  <div className="space-y-1">
                    {activeChapters.map((chap) => (
                      <div
                        key={chap.id}
                        className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300"
                      >
                        <div className="font-medium text-slate-200">{chap.title}</div>
                        {chap.description && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {chap.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Middle Column: Materials List (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search materials in subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredMaterials.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-400">No study materials found</p>
                  <button
                    onClick={() => setShowMaterialModal(true)}
                    className="mt-3 text-xs text-cyan-400 hover:underline"
                  >
                    + Add first material
                  </button>
                </div>
              ) : (
                filteredMaterials.map((mat) => {
                  const isSelected = selectedMaterial?.id === mat.id;
                  const chap = chapters.find((c) => c.id === mat.chapterId);
                  return (
                    <div
                      key={mat.id}
                      onClick={() => setSelectedMaterial(mat)}
                      className={`p-3.5 rounded-xl cursor-pointer border transition-all text-left ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-700/60 shadow-sm'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-xs font-semibold leading-snug ${
                            isSelected ? 'text-cyan-300' : 'text-slate-200'
                          }`}
                        >
                          {mat.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMaterial(mat.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {chap && (
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          {chap.title}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-mono">
                        <span>{mat.wordCount} words</span>
                        <span>•</span>
                        <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Material Preview & Actions (5 cols) */}
          <div className="md:col-span-5">
            {selectedMaterial ? (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col h-full max-h-[700px]">
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {selectedMaterial.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>{selectedMaterial.wordCount} words</span>
                      <span>•</span>
                      <span>Source: {selectedMaterial.sourceType}</span>
                    </div>
                  </div>
                </div>

                {/* Instant Study Lab Action Launcher */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                  <button
                    onClick={() => onNavigateToStudyLab(selectedMaterial.id, 'notes')}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 text-xs font-medium transition-all group"
                  >
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Gen Notes</span>
                  </button>

                  <button
                    onClick={() => onNavigateToStudyLab(selectedMaterial.id, 'quiz')}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-400 text-xs font-medium transition-all group"
                  >
                    <GraduationCap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Create Quiz</span>
                  </button>

                  <button
                    onClick={() => onNavigateToStudyLab(selectedMaterial.id, 'ask')}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-medium transition-all group"
                  >
                    <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Ask Material</span>
                  </button>
                </div>

                {/* Content preview scroll area */}
                <div className="flex-1 overflow-y-auto rounded-xl bg-slate-950/80 p-4 border border-slate-800/80 text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                  {selectedMaterial.content}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 flex flex-col items-center justify-center h-full">
                <FileText className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 font-medium">Select a material to preview or generate notes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateSubject}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4"
          >
            <h3 className="font-bold text-base text-white">Create New Subject</h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Subject Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. AP Biology or Data Structures"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Course Code</label>
                <input
                  type="text"
                  placeholder="e.g. BIO-101"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Color Accent</label>
                <div className="flex items-center gap-2 pt-1">
                  {['#06B6D4', '#10B981', '#8B5CF6', '#F59E0B', '#F43F5E', '#3B82F6'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSubjectColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        subjectColor === c ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Brief outline of syllabus or topics..."
                value={subjectDesc}
                onChange={(e) => setSubjectDesc(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
              >
                Create Subject
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chapter Modal */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateChapter}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4"
          >
            <h3 className="font-bold text-base text-white">
              Add Chapter to {activeSubject?.name}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Chapter Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chapter 4: Photosynthesis & Light Reactions"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Key Topics Outline</label>
              <input
                type="text"
                placeholder="e.g. PSII, PSI, Chemiosmosis, Calvin Cycle"
                value={chapterDesc}
                onChange={(e) => setChapterDesc(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
              >
                Add Chapter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Study Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateMaterial}
            className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Add Study Material</h3>
              <span className="text-xs text-slate-400">
                Pasted text or upload document
              </span>
            </div>

            {/* Document Uploader */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-dashed border-slate-800 text-center">
              <input
                type="file"
                id="docUpload"
                accept=".txt,.md,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="docUpload"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">
                  {isProcessingFile ? 'Extracting text...' : 'Upload Text Document or PDF (.txt, .md, .pdf)'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Files are processed client-side and saved securely to your library.
                </span>
              </label>

              {uploadError && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800 text-[11px] text-amber-300 flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Material Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Photosynthesis: Light & Dark Reactions"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Assign to Chapter (Optional)
                </label>
                <select
                  value={materialChapterId}
                  onChange={(e) => setMaterialChapterId(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="">No specific chapter</option>
                  {activeChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-400">
                  Chapter Text / Study Content *
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {materialContent.length} chars
                </span>
              </div>
              <textarea
                required
                rows={9}
                placeholder="Paste lecture notes, textbook excerpts, definitions, or article content here..."
                value={materialContent}
                onChange={(e) => setMaterialContent(e.target.value)}
                className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-3 text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 font-sans leading-relaxed"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25"
              >
                Save to Library
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
