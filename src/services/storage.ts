import {
  Subject,
  Chapter,
  StudyMaterial,
  StudyTask,
  GeneratedNotes,
  Quiz,
  QuizAttempt,
  Flashcard,
  StudySession,
  StudyGoal,
} from '../types';
import { addCalendarDays, localDateString } from './dates';

const STORAGE_KEYS = {
  SUBJECTS: 'studyos_subjects',
  CHAPTERS: 'studyos_chapters',
  MATERIALS: 'studyos_materials',
  TASKS: 'studyos_tasks',
  NOTES: 'studyos_notes',
  QUIZZES: 'studyos_quizzes',
  ATTEMPTS: 'studyos_attempts',
  FLASHCARDS: 'studyos_flashcards',
  SESSIONS: 'studyos_sessions',
  GOAL: 'studyos_goal',
  IS_INITIALIZED: 'studyos_is_initialized_v2',
};

function isValidImportedRecord(collection: string, value: any): boolean {
  const isText = (field: unknown) => typeof field === 'string';
  const hasId = isText(value?.id) && value.id.length > 0;
  switch (collection) {
    case 'subjects':
      return hasId && isText(value.name) && isText(value.color) && isText(value.icon) && isText(value.description) && isText(value.createdAt);
    case 'chapters':
      return hasId && isText(value.subjectId) && isText(value.title) && Number.isInteger(value.order);
    case 'materials':
      return hasId && isText(value.subjectId) && isText(value.title) && isText(value.content) && ['pasted', 'uploaded_text', 'uploaded_pdf', 'notes'].includes(value.sourceType) && Number.isFinite(value.characterCount) && Number.isFinite(value.wordCount);
    case 'tasks':
      return hasId && isText(value.title) && isText(value.subjectId) && isText(value.dueDate) && Number.isFinite(value.estimatedMinutes) && ['high', 'medium', 'low'].includes(value.priority) && typeof value.completed === 'boolean';
    case 'notes':
      return hasId && isText(value.subjectId) && isText(value.title) && isText(value.content) && Array.isArray(value.keyTakeaways);
    case 'quizzes':
      return hasId && isText(value.subjectId) && isText(value.title) && Array.isArray(value.questions) && value.questions.every((question: any) =>
        isText(question.question) && ['mcq', 'short_answer'].includes(question.type) && isText(question.concept) && isText(question.explanation) &&
        (question.type === 'mcq'
          ? Array.isArray(question.options) && question.options.length === 4 && question.options.every(isText) && Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0 && question.correctAnswer < 4
          : isText(question.expectedAnswer) && !!question.expectedAnswer.trim())
      );
    case 'attempts':
      return hasId && isText(value.quizId) && isText(value.quizTitle) && isText(value.subjectId) && Array.isArray(value.answers) && value.answers.every((answer: any) =>
        isText(answer.questionId) && isText(answer.questionText) && isText(answer.concept) && typeof answer.isCorrect === 'boolean' && Number.isFinite(answer.score)
      );
    case 'flashcards':
      return hasId && isText(value.subjectId) && isText(value.concept) && isText(value.front) && isText(value.back) && isText(value.nextReviewDate) && Number.isFinite(value.intervalDays) && Number.isFinite(value.easeFactor);
    case 'sessions':
      return hasId && isText(value.subjectId) && Number.isFinite(value.durationMinutes) && isText(value.date) && isText(value.timestamp) && ['reading', 'notes_gen', 'quiz', 'flashcards', 'revision', 'custom_timer'].includes(value.type);
    default:
      return false;
  }
}

// Explicit opt-in sample curriculum for demonstrations and testing.
export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'subj-bio',
    name: 'AP Biology',
    code: 'BIO-101',
    color: '#10B981', // Emerald green
    icon: 'Leaf',
    description: 'Cellular processes, genetics, photosynthesis, and metabolic pathways.',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'subj-cs',
    name: 'Computer Science',
    code: 'CS-201',
    color: '#06B6D4', // Cyan
    icon: 'Cpu',
    description: 'Data structures, algorithm complexity, dynamic programming, and graphs.',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'subj-chem',
    name: 'Organic Chemistry',
    code: 'CHEM-302',
    color: '#8B5CF6', // Purple
    icon: 'Atom',
    description: 'Reaction mechanisms, stereochemistry, and functional group transformations.',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const INITIAL_CHAPTERS: Chapter[] = [
  {
    id: 'chap-bio-1',
    subjectId: 'subj-bio',
    title: 'Chapter 8: Photosynthesis & Energy Coupling',
    description: 'Light-dependent reactions, photophosphorylation, Calvin Cycle, and RuBisCO regulation.',
    order: 1,
  },
  {
    id: 'chap-cs-1',
    subjectId: 'subj-cs',
    title: 'Chapter 4: Algorithmic Complexity & Big-O Notation',
    description: 'Time and space complexity bounds, asymptotic growth, and recursion analysis.',
    order: 1,
  },
];

export const INITIAL_MATERIALS: StudyMaterial[] = [
  {
    id: 'mat-photosynthesis',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    title: 'Photosynthesis: Light Reactions and Calvin Cycle Mechanics',
    sourceType: 'pasted',
    characterCount: 3420,
    wordCount: 520,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    content: `Photosynthesis is the biological process by which autotrophic organisms, primarily green plants, algae, and cyanobacteria, convert solar radiant energy into stable chemical energy stored in carbohydrates.

1. Structural Compartmentalization
Photosynthesis occurs inside chloroplasts, double-membraned organelles containing fluid stroma and disc-shaped thylakoids stacked into grana. The thylakoid membranes harbor the photosystems and electron transport chains, while the stroma contains enzymes for carbohydrate synthesis.

2. Light-Dependent Reactions (Thylakoid Membrane)
During the light reactions, photons strike Photosystem II (PSII, P680). This excitation energizes electrons, which are transferred along an electron transport chain via plastoquinone, the cytochrome b6f complex, and plastocyanin to Photosystem I (PSI, P700).
- Photolysis: To replace the lost electrons in PSII, an oxygen-evolving complex splits water molecules (2 H2O -> 4 H+ + 4 e- + O2). This releases molecular oxygen as a byproduct into the atmosphere.
- Chemiosmotic ATP Synthesis: Protons are actively pumped into the thylakoid lumen, establishing a steep electrochemical proton gradient (delta pH). As protons flux back into the stroma through ATP synthase, ADP and inorganic phosphate condense to produce ATP (photophosphorylation).
- NADPH Generation: Electrons excited at PSI reduce NADP+ via ferredoxin-NADP+ reductase (FNR) to generate NADPH in the stroma.

3. The Light-Independent Reactions (Calvin Cycle / Stroma)
The chemical energy stored in ATP and NADPH powers the reduction of atmospheric carbon dioxide into glyceraldehyde-3-phosphate (G3P) across three distinct phases:
- Phase 1: Carbon Fixation: The enzyme Ribulose-1,5-bisphosphate carboxylase/oxygenase (RuBisCO) catalyzes the carboxylation of a 5-carbon sugar (RuBP) with CO2, yielding an unstable 6-carbon intermediate that immediately splits into two molecules of 3-phosphoglycerate (3-PGA).
- Phase 2: Reduction: ATP and NADPH phosphorylate and reduce 3-PGA into glyceraldehyde-3-phosphate (G3P). For every 3 turns of the cycle (fixing 3 CO2), 6 G3P are formed; 1 net G3P exits to form glucose, while 5 remain.
- Phase 3: Regeneration of RuBP: The remaining 5 G3P molecules are rearranged using 3 additional ATP molecules to regenerate 3 RuBP acceptors, allowing continuous carbon fixation.

4. Photorespiration: A Limiting Factor
When ambient temperatures rise or stomata close to conserve water, oxygen competes with CO2 at the RuBisCO active site. This produces 2-phosphoglycolate, initiating photorespiration which wastes ATP and releases previously fixed carbon without generating energy.`,
  },
];

export const INITIAL_TASKS: StudyTask[] = [
  {
    id: 'task-1',
    title: 'Review Calvin Cycle 3 Phases & RuBisCO',
    description: 'Focus on ATP/NADPH stoichiometry and net G3P output.',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    dueDate: localDateString(addCalendarDays(1)),
    dueTime: '17:00',
    estimatedMinutes: 30,
    actualMinutesSpent: 0,
    priority: 'high',
    completed: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'task-2',
    title: 'Solve Big-O Recurrence Relations Problem Set',
    description: 'Analyze merge sort and binary search recurrences using Master Theorem.',
    subjectId: 'subj-cs',
    chapterId: 'chap-cs-1',
    dueDate: localDateString(addCalendarDays(2)),
    dueTime: '20:00',
    estimatedMinutes: 45,
    actualMinutesSpent: 45,
    priority: 'medium',
    completed: true,
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'task-3',
    title: 'Take Diagnostics Quiz on Photolysis & Electron Transport',
    description: 'Targeted practice for weak concept identified yesterday.',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    dueDate: localDateString(),
    dueTime: '18:30',
    estimatedMinutes: 20,
    actualMinutesSpent: 0,
    priority: 'high',
    completed: false,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
];

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'quiz-photosynthesis',
    materialId: 'mat-photosynthesis',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    title: 'Diagnostic Quiz: Light Reactions & Carbon Fixation',
    difficulty: 'medium',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    questions: [
      {
        id: 'q-1',
        type: 'mcq',
        question: 'What is the immediate source of replacement electrons for the oxidized P680 reaction center in Photosystem II?',
        options: [
          'Photolysis of water molecules (H2O)',
          'Oxidation of NADPH to NADP+',
          'Dephosphorylation of ATP in the stroma',
          'Electron transfer directly from Photosystem I',
        ],
        correctAnswer: 0,
        explanation: 'Water splitting (photolysis) by the oxygen-evolving complex at PSII replenishes the electrons lost by P680 upon photon excitation, yielding H+ and molecular oxygen (O2).',
        concept: 'Photolysis & PSII',
        difficulty: 'medium',
      },
      {
        id: 'q-2',
        type: 'mcq',
        question: 'During the light reactions, where does the highest concentration of hydrogen ions (protons) accumulate to drive chemiosmotic ATP synthesis?',
        options: [
          'Inside the chloroplast stroma',
          'Within the thylakoid lumen',
          'In the intermembrane space between chloroplast envelopes',
          'Outside the cell in the cytosol',
        ],
        correctAnswer: 1,
        explanation: 'Protons pumped across the thylakoid membrane and released by water splitting accumulate in the thylakoid lumen, creating the electrochemical gradient utilized by ATP synthase.',
        concept: 'Chemiosmotic ATP Synthesis',
        difficulty: 'medium',
      },
      {
        id: 'q-3',
        type: 'mcq',
        question: 'Why does photorespiration diminish the photosynthetic efficiency of C3 plants in hot, arid conditions?',
        options: [
          'RuBisCO binds oxygen instead of CO2, consuming ATP without producing sugars',
          'Chlorophyll pigments degrade rapidly under high photon flux',
          'ATP synthase reverses direction and hydrolyzes ATP in the lumen',
          'Water molecules evaporate before entering chloroplasts',
        ],
        correctAnswer: 0,
        explanation: 'Under closed stomata and low internal CO2, RuBisCO oxygenates RuBP to form 2-phosphoglycolate, triggering an energy-wasting metabolic salvage pathway.',
        concept: 'Photorespiration & RuBisCO',
        difficulty: 'hard',
      },
      {
        id: 'q-4',
        type: 'mcq',
        question: 'How many net molecules of Glyceraldehyde-3-phosphate (G3P) exit the Calvin Cycle for every three molecules of CO2 fixed?',
        options: [
          '1 net G3P molecule',
          '3 net G3P molecules',
          '6 net G3P molecules',
          '0, all G3P is immediately converted into ATP',
        ],
        correctAnswer: 0,
        explanation: 'Fixing 3 CO2 produces 6 molecules of G3P. One net G3P exits to form glucose and other carbohydrates, while the remaining 5 G3P are recycled into 3 RuBP acceptors.',
        concept: 'Calvin Cycle Stoichiometry',
        difficulty: 'hard',
      },
    ],
  },
];

export const INITIAL_ATTEMPTS: QuizAttempt[] = [
  {
    id: 'att-1',
    quizId: 'quiz-photosynthesis',
    quizTitle: 'Diagnostic Quiz: Light Reactions & Carbon Fixation',
    materialId: 'mat-photosynthesis',
    subjectId: 'subj-bio',
    score: 2,
    totalQuestions: 4,
    percentage: 50,
    timeSpentSeconds: 145,
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    weakConceptsIdentified: ['Calvin Cycle Stoichiometry', 'Photorespiration & RuBisCO'],
    answers: [
      {
        questionId: 'q-1',
        questionText: 'What is the immediate source of replacement electrons for the oxidized P680 reaction center in Photosystem II?',
        type: 'mcq',
        concept: 'Photolysis & PSII',
        selectedOption: 0,
        isCorrect: true,
        score: 100,
        correctAnswerText: 'Photolysis of water molecules (H2O)',
        explanation: 'Water splitting replenishes P680 electrons.',
      },
      {
        questionId: 'q-2',
        questionText: 'During the light reactions, where does the highest concentration of hydrogen ions accumulate?',
        type: 'mcq',
        concept: 'Chemiosmotic ATP Synthesis',
        selectedOption: 1,
        isCorrect: true,
        score: 100,
        correctAnswerText: 'Within the thylakoid lumen',
        explanation: 'Protons accumulate in the lumen.',
      },
      {
        questionId: 'q-3',
        questionText: 'Why does photorespiration diminish the photosynthetic efficiency of C3 plants?',
        type: 'mcq',
        concept: 'Photorespiration & RuBisCO',
        selectedOption: 1, // User selected wrong option
        isCorrect: false,
        score: 0,
        correctAnswerText: 'RuBisCO binds oxygen instead of CO2, consuming ATP without producing sugars',
        explanation: 'RuBisCO oxygenation causes photorespiration.',
      },
      {
        questionId: 'q-4',
        questionText: 'How many net molecules of G3P exit the Calvin Cycle for every three CO2 fixed?',
        type: 'mcq',
        concept: 'Calvin Cycle Stoichiometry',
        selectedOption: 2, // Selected 6 instead of 1 net
        isCorrect: false,
        score: 0,
        correctAnswerText: '1 net G3P molecule',
        explanation: '6 are formed total, but 5 are used for RuBP regeneration; only 1 net G3P exits.',
      },
    ],
  },
];

export const INITIAL_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc-1',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    materialId: 'mat-photosynthesis',
    concept: 'Photolysis',
    front: 'What chemical reaction provides the electrons to replace those energized from P680 in PSII?',
    back: 'Photolysis (water splitting): 2 H2O -> 4 H+ + 4 e- + O2. Driven by the oxygen-evolving complex.',
    repetitions: 1,
    intervalDays: 3,
    easeFactor: 2.5,
    nextReviewDate: localDateString(addCalendarDays(2)),
    lastReviewedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'fc-2',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    materialId: 'mat-photosynthesis',
    concept: 'Calvin Cycle Stoichiometry',
    front: 'For 3 molecules of CO2 entering the Calvin Cycle, how many G3P molecules exit as net output?',
    back: '1 net G3P molecule. (6 G3P are formed, but 5 are needed to regenerate 3 RuBP acceptors).',
    repetitions: 0,
    intervalDays: 1,
    easeFactor: 2.3,
    nextReviewDate: localDateString(), // Due today!
    lastReviewedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'fc-3',
    subjectId: 'subj-bio',
    chapterId: 'chap-bio-1',
    materialId: 'mat-photosynthesis',
    concept: 'Photorespiration & RuBisCO',
    front: 'Why does RuBisCO cause photorespiration when stomata close during water stress?',
    back: 'CO2 levels drop while O2 levels rise; RuBisCO binds O2 instead of CO2, consuming ATP and producing 2-phosphoglycolate without generating sugar.',
    repetitions: 0,
    intervalDays: 1,
    easeFactor: 2.2,
    nextReviewDate: localDateString(), // Due today!
    lastReviewedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const INITIAL_SESSIONS: StudySession[] = [
  {
    id: 'sess-1',
    subjectId: 'subj-bio',
    durationMinutes: 45,
    date: localDateString(addCalendarDays(-2)),
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    type: 'reading',
    notes: 'Studied chloroplast anatomy & light reactions.',
  },
  {
    id: 'sess-2',
    subjectId: 'subj-cs',
    durationMinutes: 35,
    date: localDateString(addCalendarDays(-1)),
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    type: 'revision',
    notes: 'Big-O tree recursion exercises.',
  },
  {
    id: 'sess-3',
    subjectId: 'subj-bio',
    durationMinutes: 25,
    date: localDateString(),
    timestamp: new Date().toISOString(),
    type: 'quiz',
    notes: 'Diagnostic quiz completed on Photosynthesis.',
  },
];

export const INITIAL_GOAL: StudyGoal = {
  dailyMinutesTarget: 60,
  weeklyQuizzesTarget: 5,
};

// Storage helper functions
export const storage = {
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.IS_INITIALIZED)) {
      this.clearAllData();
    }
  },

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(INITIAL_SUBJECTS));
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(INITIAL_CHAPTERS));
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(INITIAL_MATERIALS));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(INITIAL_QUIZZES));
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(INITIAL_ATTEMPTS));
    localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(INITIAL_FLASHCARDS));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_SESSIONS));
    localStorage.setItem(STORAGE_KEYS.GOAL, JSON.stringify(INITIAL_GOAL));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
    window.dispatchEvent(new Event('studyos_storage_change'));
  },

  clearAllData() {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.GOAL, JSON.stringify(INITIAL_GOAL));
    localStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
    window.dispatchEvent(new Event('studyos_storage_change'));
  },

  // Subjects
  getSubjects(): Subject[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveSubjects(subjects: Subject[]) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addSubject(subject: Omit<Subject, 'id' | 'createdAt'>): Subject {
    const subjects = this.getSubjects();
    const newSubject: Subject = {
      ...subject,
      id: `subj-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.saveSubjects([...subjects, newSubject]);
    return newSubject;
  },
  updateSubject(id: string, updates: Partial<Subject>): Subject | null {
    const subjects = this.getSubjects();
    const index = subjects.findIndex((s) => s.id === id);
    if (index === -1) return null;
    subjects[index] = { ...subjects[index], ...updates };
    this.saveSubjects(subjects);
    return subjects[index];
  },
  deleteSubject(id: string) {
    const subjects = this.getSubjects().filter((s) => s.id !== id);
    this.saveSubjects(subjects);
    // cascade delete
    this.saveChapters(this.getChapters().filter((c) => c.subjectId !== id));
    this.saveMaterials(this.getMaterials().filter((m) => m.subjectId !== id));
    this.saveTasks(this.getTasks().filter((t) => t.subjectId !== id));
  },

  // Chapters
  getChapters(): Chapter[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAPTERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveChapters(chapters: Chapter[]) {
    localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(chapters));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addChapter(chapter: Omit<Chapter, 'id'>): Chapter {
    const chapters = this.getChapters();
    const newChapter: Chapter = {
      ...chapter,
      id: `chap-${Date.now()}`,
    };
    this.saveChapters([...chapters, newChapter]);
    return newChapter;
  },

  // Materials
  getMaterials(): StudyMaterial[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveMaterials(materials: StudyMaterial[]) {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addMaterial(mat: Omit<StudyMaterial, 'id' | 'createdAt' | 'updatedAt' | 'characterCount' | 'wordCount'>): StudyMaterial {
    const materials = this.getMaterials();
    const words = mat.content.trim() ? mat.content.trim().split(/\s+/).length : 0;
    const newMat: StudyMaterial = {
      ...mat,
      id: `mat-${Date.now()}`,
      characterCount: mat.content.length,
      wordCount: words,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveMaterials([newMat, ...materials]);
    return newMat;
  },
  updateMaterial(id: string, updates: Partial<StudyMaterial>): StudyMaterial | null {
    const materials = this.getMaterials();
    const idx = materials.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const updated = {
      ...materials[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
      characterCount: (updates.content !== undefined ? updates.content.length : materials[idx].characterCount),
      wordCount: (updates.content !== undefined ? (updates.content.trim() ? updates.content.trim().split(/\s+/).length : 0) : materials[idx].wordCount),
    };
    materials[idx] = updated;
    this.saveMaterials(materials);
    return updated;
  },
  deleteMaterial(id: string) {
    this.saveMaterials(this.getMaterials().filter((m) => m.id !== id));
  },

  // Tasks
  getTasks(): StudyTask[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveTasks(tasks: StudyTask[]) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addTask(task: Omit<StudyTask, 'id' | 'createdAt' | 'actualMinutesSpent'>): StudyTask {
    const tasks = this.getTasks();
    const newTask: StudyTask = {
      ...task,
      id: `task-${Date.now()}`,
      actualMinutesSpent: 0,
      createdAt: new Date().toISOString(),
    };
    this.saveTasks([newTask, ...tasks]);
    return newTask;
  },
  toggleTask(id: string): StudyTask | null {
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const isCompleted = !tasks[idx].completed;
    tasks[idx] = {
      ...tasks[idx],
      completed: isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
    };
    this.saveTasks(tasks);
    return tasks[idx];
  },
  updateTask(id: string, updates: Partial<StudyTask>): StudyTask | null {
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates };
    this.saveTasks(tasks);
    return tasks[idx];
  },
  deleteTask(id: string) {
    this.saveTasks(this.getTasks().filter((t) => t.id !== id));
  },

  // Notes
  getNotes(): GeneratedNotes[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveNotes(notes: GeneratedNotes[]) {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addNotes(note: Omit<GeneratedNotes, 'id' | 'createdAt'>): GeneratedNotes {
    const notes = this.getNotes();
    const newNote: GeneratedNotes = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.saveNotes([newNote, ...notes]);
    return newNote;
  },

  // Quizzes
  getQuizzes(): Quiz[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveQuizzes(quizzes: Quiz[]) {
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addQuiz(quiz: Omit<Quiz, 'id' | 'createdAt'>): Quiz {
    const quizzes = this.getQuizzes();
    const newQuiz: Quiz = {
      ...quiz,
      id: `quiz-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.saveQuizzes([newQuiz, ...quizzes]);
    return newQuiz;
  },

  // Quiz Attempts
  getAttempts(): QuizAttempt[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveAttempts(attempts: QuizAttempt[]) {
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addAttempt(attempt: Omit<QuizAttempt, 'id' | 'completedAt'>): QuizAttempt {
    const attempts = this.getAttempts();
    const newAttempt: QuizAttempt = {
      ...attempt,
      id: `att-${Date.now()}`,
      completedAt: new Date().toISOString(),
    };
    this.saveAttempts([newAttempt, ...attempts]);

    // Automatically record a study session for the quiz time
    this.addSession({
      subjectId: attempt.subjectId,
      durationMinutes: Math.max(1, Math.round(attempt.timeSpentSeconds / 60)),
      type: 'quiz',
      notes: `Completed quiz "${attempt.quizTitle}" with ${attempt.score}/${attempt.totalQuestions} (${attempt.percentage}%)`,
    });

    return newAttempt;
  },

  // Flashcards
  getFlashcards(): Flashcard[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveFlashcards(flashcards: Flashcard[]) {
    localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(flashcards));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addFlashcard(card: Omit<Flashcard, 'id' | 'repetitions' | 'intervalDays' | 'easeFactor' | 'nextReviewDate'>): Flashcard {
    const cards = this.getFlashcards();
    const newCard: Flashcard = {
      ...card,
      id: `fc-${Date.now()}`,
      repetitions: 0,
      intervalDays: 1,
      easeFactor: 2.5,
      nextReviewDate: localDateString(),
    };
    this.saveFlashcards([newCard, ...cards]);
    return newCard;
  },
  updateFlashcardReview(id: string, rating: 'again' | 'hard' | 'good' | 'easy'): Flashcard | null {
    const cards = this.getFlashcards();
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const card = cards[idx];
    let interval = card.intervalDays;
    let repetitions = card.repetitions;
    let easeFactor = card.easeFactor;

    if (rating === 'again') {
      interval = 1;
      repetitions = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else if (rating === 'hard') {
      interval = Math.max(1, Math.round(interval * 1.2));
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else if (rating === 'good') {
      repetitions += 1;
      interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(interval * easeFactor);
    } else if (rating === 'easy') {
      repetitions += 1;
      interval = repetitions === 1 ? 3 : repetitions === 2 ? 7 : Math.round(interval * easeFactor * 1.3);
      easeFactor += 0.15;
    }

    const nextDate = addCalendarDays(interval);

    cards[idx] = {
      ...card,
      repetitions,
      intervalDays: interval,
      easeFactor,
      nextReviewDate: localDateString(nextDate),
      lastReviewedAt: new Date().toISOString(),
    };

    this.saveFlashcards(cards);
    return cards[idx];
  },

  // Study Sessions
  getSessions(): StudySession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveSessions(sessions: StudySession[]) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },
  addSession(session: Omit<StudySession, 'id' | 'date' | 'timestamp'>): StudySession {
    const sessions = this.getSessions();
    const now = new Date();
    const newSession: StudySession = {
      ...session,
      id: `sess-${Date.now()}`,
      date: localDateString(now),
      timestamp: now.toISOString(),
    };
    this.saveSessions([newSession, ...sessions]);
    return newSession;
  },

  // Goals
  getGoal(): StudyGoal {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOAL);
      return data ? JSON.parse(data) : INITIAL_GOAL;
    } catch {
      return INITIAL_GOAL;
    }
  },
  saveGoal(goal: StudyGoal) {
    localStorage.setItem(STORAGE_KEYS.GOAL, JSON.stringify(goal));
    window.dispatchEvent(new Event('studyos_storage_change'));
  },

  // Export / Import
  exportAll() {
    return {
      subjects: this.getSubjects(),
      chapters: this.getChapters(),
      materials: this.getMaterials(),
      tasks: this.getTasks(),
      notes: this.getNotes(),
      quizzes: this.getQuizzes(),
      attempts: this.getAttempts(),
      flashcards: this.getFlashcards(),
      sessions: this.getSessions(),
      goal: this.getGoal(),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
  },
  importAll(jsonString: string, mode: 'merge' | 'replace' = 'merge') {
    try {
      if (mode !== 'merge' && mode !== 'replace') {
        return { success: false, error: 'Import mode is invalid.' };
      }
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { success: false, error: 'Import must be a StudyOS JSON object.' };
      }

      const collections = [
        ['subjects', STORAGE_KEYS.SUBJECTS, this.getSubjects()],
        ['chapters', STORAGE_KEYS.CHAPTERS, this.getChapters()],
        ['materials', STORAGE_KEYS.MATERIALS, this.getMaterials()],
        ['tasks', STORAGE_KEYS.TASKS, this.getTasks()],
        ['notes', STORAGE_KEYS.NOTES, this.getNotes()],
        ['quizzes', STORAGE_KEYS.QUIZZES, this.getQuizzes()],
        ['attempts', STORAGE_KEYS.ATTEMPTS, this.getAttempts()],
        ['flashcards', STORAGE_KEYS.FLASHCARDS, this.getFlashcards()],
        ['sessions', STORAGE_KEYS.SESSIONS, this.getSessions()],
      ] as const;
      const providedCollections = collections.filter(([name]) => Object.prototype.hasOwnProperty.call(data, name));
      if (providedCollections.length === 0 && !Object.prototype.hasOwnProperty.call(data, 'goal')) {
        return { success: false, error: 'Import contains no StudyOS records.' };
      }
      if (mode === 'replace' && (providedCollections.length !== collections.length || !Object.prototype.hasOwnProperty.call(data, 'goal'))) {
        return { success: false, error: 'Replacing data requires a complete StudyOS backup.' };
      }

      const writes: [string, string][] = [];
      let preservedRecords = 0;
      for (const [name, storageKey, existing] of providedCollections) {
        const incoming = data[name];
        if (!Array.isArray(incoming) || incoming.some((record: unknown) =>
          !record || typeof record !== 'object' || Array.isArray(record) || !isValidImportedRecord(name, record)
        ) || new Set(incoming.map((record: { id: string }) => record.id)).size !== incoming.length) {
          return { success: false, error: `Import collection "${name}" is invalid.` };
        }
        if (mode === 'merge') {
          const existingIds = new Set(existing.map((record) => record.id));
          const additions = incoming.filter((record: { id: string }) => {
            if (existingIds.has(record.id)) {
              preservedRecords += 1;
              return false;
            }
            existingIds.add(record.id);
            return true;
          });
          writes.push([storageKey, JSON.stringify([...existing, ...additions])]);
        } else {
          writes.push([storageKey, JSON.stringify(incoming)]);
        }
      }

      if (Object.prototype.hasOwnProperty.call(data, 'goal')) {
        const goal = data.goal;
        if (!goal || typeof goal !== 'object' || !Number.isFinite(goal.dailyMinutesTarget) || goal.dailyMinutesTarget <= 0 || !Number.isFinite(goal.weeklyQuizzesTarget) || goal.weeklyQuizzesTarget <= 0) {
          return { success: false, error: 'Import goal settings are invalid.' };
        }
        if (mode === 'replace') writes.push([STORAGE_KEYS.GOAL, JSON.stringify(goal)]);
      }

      const previousValues = writes.map(([key]) => [key, localStorage.getItem(key)] as const);
      try {
        for (const [key, value] of writes) localStorage.setItem(key, value);
      } catch (error) {
        for (const [key, value] of previousValues) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        throw error;
      }
      window.dispatchEvent(new Event('studyos_storage_change'));
      return { success: true, preservedRecords, preservedGoal: mode === 'merge' && Object.prototype.hasOwnProperty.call(data, 'goal') };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
