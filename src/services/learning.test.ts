import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { StudyIntelligenceEngine } from './intelligence';
import { storage } from './storage';
import { QuizAttempt, Subject } from '../types';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { dispatchEvent: () => true },
});

const subject: Subject = {
  id: 'subject-test',
  name: 'Biology',
  color: '#ffffff',
  icon: 'BookOpen',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function makeAttempt(id: string, isCorrect: boolean, daysAgo: number): QuizAttempt {
  const completedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id,
    quizId: id,
    quizTitle: 'Photosynthesis Quiz',
    subjectId: subject.id,
    score: Number(isCorrect),
    totalQuestions: 1,
    percentage: isCorrect ? 100 : 0,
    timeSpentSeconds: 30,
    completedAt,
    weakConceptsIdentified: isCorrect ? [] : ['Photosynthesis'],
    answers: [{
      questionId: 'question-1',
      questionText: 'What splits water?',
      type: 'mcq',
      concept: 'Photosynthesis',
      selectedOption: isCorrect ? 0 : 1,
      isCorrect,
      score: isCorrect ? 100 : 0,
      correctAnswerText: 'Photolysis',
      explanation: 'Water is split during photolysis.',
    }],
  };
}

beforeEach(() => {
  values.clear();
  storage.init();
});

test('fresh initialization does not invent study history', () => {
  assert.deepEqual(storage.getSubjects(), []);
  assert.deepEqual(storage.getAttempts(), []);
  assert.deepEqual(storage.getSessions(), []);
});

test('backup merge preserves matching IDs and invalid replacement is atomic', () => {
  storage.addSubject({ name: subject.name, color: subject.color, icon: subject.icon, description: subject.description });
  const backup = storage.exportAll();
  const merged = storage.importAll(JSON.stringify(backup), 'merge');
  assert.equal(merged.success, true);
  assert.equal(merged.preservedRecords, 1);

  const invalidBackup = { ...backup, subjects: [{ id: 'broken' }] };
  assert.equal(storage.importAll(JSON.stringify(invalidBackup), 'replace').success, false);
  assert.equal(storage.getSubjects().length, 1);
});

test('mastery requires two successful sessions and a recent miss removes it', () => {
  const singleSession = StudyIntelligenceEngine.analyzeConcepts([makeAttempt('a1', true, 0)], [subject]);
  assert.equal(singleSession[0].masteryStatus, 'unverified');

  const repeatedSuccess = StudyIntelligenceEngine.analyzeConcepts([
    makeAttempt('a1', true, 1),
    makeAttempt('a2', true, 0),
  ], [subject]);
  assert.equal(repeatedSuccess[0].masteryStatus, 'mastered');

  const recentMistake = StudyIntelligenceEngine.analyzeConcepts([
    makeAttempt('a1', true, 2),
    makeAttempt('a2', true, 1),
    makeAttempt('a3', false, 0),
  ], [subject]);
  assert.notEqual(recentMistake[0].masteryStatus, 'mastered');
});

test('study plan excludes completed tasks and stays within available minutes', () => {
  const tasks = Array.from({ length: 10 }, (_, index) => ({
    id: `task-${index}`,
    title: `Task ${index}`,
    subjectId: subject.id,
    dueDate: `2026-11-${String(index + 3).padStart(2, '0')}`,
    estimatedMinutes: 60,
    actualMinutesSpent: 0,
    priority: 'high' as const,
    completed: index === 9,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
  const weakTopics = StudyIntelligenceEngine.analyzeConcepts([makeAttempt('a1', false, 0)], [subject]);
  const plan = StudyIntelligenceEngine.generateStudyPlan(tasks, weakTopics, 1);
  const totalMinutes = plan.suggestedBlocks.reduce(
    (total, block) => total + Number(block.time.match(/(\d+) min/)?.[1] || 0),
    0
  );

  assert.ok(totalMinutes <= 60);
  assert.ok(plan.suggestedBlocks.every((block) => !block.activity.includes('Task 9')));
});