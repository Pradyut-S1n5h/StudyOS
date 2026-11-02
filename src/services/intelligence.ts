import {
  QuizAttempt,
  StudyTask,
  Flashcard,
  Subject,
  StudyMaterial,
  SpacedTopic,
  StudyRecommendation,
} from '../types';
import { addCalendarDays, localDateString } from './dates';

export class StudyIntelligenceEngine {
  static generateStudyPlan(
    tasks: StudyTask[],
    weakTopics: SpacedTopic[],
    availableHoursPerDay: number
  ) {
    const availableMinutes = Math.max(0, Math.floor(availableHoursPerDay * 60));
    const pendingTasks = tasks
      .filter((task) => !task.completed && task.dueDate)
      .sort((a, b) => {
        const deadlineOrder = a.dueDate.localeCompare(b.dueDate);
        if (deadlineOrder !== 0) return deadlineOrder;
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority];
      });
    const revisions = [...weakTopics].sort((a, b) => {
      const dueOrder = (a.status === 'overdue' ? 0 : a.status === 'due_today' ? 1 : 2) -
        (b.status === 'overdue' ? 0 : b.status === 'due_today' ? 1 : 2);
      return dueOrder || a.accuracy - b.accuracy || b.missedQuestionsCount - a.missedQuestionsCount;
    });
    const revisionBudget = revisions.length > 0 ? Math.min(20, Math.floor(availableMinutes / 3)) : 0;
    let taskBudget = Math.max(0, availableMinutes - revisionBudget);
    let studyBlockCount = 0;
    const suggestedBlocks: { time: string; activity: string; focusType: 'task' | 'revision' | 'quiz' | 'flashcards' | 'break' }[] = [];

    for (const task of pendingTasks) {
      if (taskBudget <= 0) break;
      const taskMinutes = Math.max(5, Math.floor(task.estimatedMinutes || 30));
      const blockMinutes = Math.min(45, taskMinutes, taskBudget);
      suggestedBlocks.push({
        time: `Block ${studyBlockCount + 1} · ${blockMinutes} min`,
        activity: `${task.title}${taskMinutes > blockMinutes ? ` (first ${blockMinutes} of ${taskMinutes} min)` : ''} · due ${task.dueDate}`,
        focusType: 'task',
      });
      taskBudget -= blockMinutes;
      studyBlockCount += 1;
      if (taskBudget >= 5 && studyBlockCount % 2 === 0) {
        suggestedBlocks.push({ time: 'Break · 5 min', activity: 'Step away briefly before the next focus block.', focusType: 'break' });
        taskBudget -= 5;
      }
    }

    if (revisionBudget > 0) {
      const revisionMinutes = revisionBudget;
      const selectedRevisions = revisions.slice(0, 3).map((topic) => topic.concept);
      suggestedBlocks.push({
        time: `Block ${studyBlockCount + 1} · ${revisionMinutes} min`,
        activity: `Retest weak concepts: ${selectedRevisions.join(', ')}`,
        focusType: 'revision',
      });
    }

    const allocatedMinutes = suggestedBlocks
      .reduce((total, block) => total + Number(block.time.match(/(\d+) min/)?.[1] || 0), 0);
    const scheduleAdvice = allocatedMinutes > 0
      ? `Scheduled ${allocatedMinutes} of ${availableMinutes} available minutes, including breaks. Pending tasks are ordered by deadline and priority; revision time targets measured weak concepts.`
      : 'No pending tasks or measured weak concepts need scheduling. Add a task or complete a diagnostic quiz to build a data-based plan.';

    return { scheduleAdvice, suggestedBlocks };
  }

  /**
   * Analyzes all quiz attempts across subjects to extract concept-level performance,
   * mistake frequency, and true measured accuracy.
   */
  static analyzeConcepts(
    attempts: QuizAttempt[],
    subjects: Subject[]
  ): SpacedTopic[] {
    const conceptMap = new Map<string, {
      concept: string;
      subjectId: string;
      chapterId?: string;
      totalAttempts: number;
      correctAttempts: number;
      missedQuestionsCount: number;
      lastTestedAt: string;
      lastAttemptCorrect: boolean;
      sessions: Set<string>;
      successfulSessions: Set<string>;
      sessionOutcomes: { completedAt: string; correct: boolean }[];
    }>();

    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    for (const attempt of attempts) {
      const attemptConcepts = new Map<string, { concept: string; answers: typeof attempt.answers }>();
      for (const answer of attempt.answers) {
        const concept = answer.concept?.trim() || 'General Review';
        const key = `${attempt.subjectId}:${attempt.chapterId || ''}:${concept.toLocaleLowerCase()}`;
        const group = attemptConcepts.get(key);
        if (group) group.answers.push(answer);
        else attemptConcepts.set(key, { concept, answers: [answer] });
      }

      for (const [key, conceptAttempt] of attemptConcepts) {
        let aggregate = conceptMap.get(key);
        if (!aggregate) {
          aggregate = {
            concept: conceptAttempt.concept,
            subjectId: attempt.subjectId,
            chapterId: attempt.chapterId,
            totalAttempts: 0,
            correctAttempts: 0,
            missedQuestionsCount: 0,
            lastTestedAt: attempt.completedAt,
            lastAttemptCorrect: false,
            sessions: new Set<string>(),
            successfulSessions: new Set<string>(),
            sessionOutcomes: [],
          };
          conceptMap.set(key, aggregate);
        }

        const correctInSession = conceptAttempt.answers.filter((answer) => answer.isCorrect).length;
        const sessionWasCorrect = correctInSession === conceptAttempt.answers.length;
        aggregate.totalAttempts += conceptAttempt.answers.length;
        aggregate.sessions.add(attempt.id);
        aggregate.correctAttempts += correctInSession;
        aggregate.missedQuestionsCount += conceptAttempt.answers.length - correctInSession;
        if (sessionWasCorrect) aggregate.successfulSessions.add(attempt.id);
        aggregate.sessionOutcomes.push({ completedAt: attempt.completedAt, correct: sessionWasCorrect });

        if (new Date(attempt.completedAt) >= new Date(aggregate.lastTestedAt)) {
          aggregate.lastTestedAt = attempt.completedAt;
          aggregate.lastAttemptCorrect = sessionWasCorrect;
        }
      }
    }

    const todayStr = localDateString();

    const topics: SpacedTopic[] = [...conceptMap.values()].map((item) => {
      const accuracy =
        item.totalAttempts > 0
          ? Math.round((item.correctAttempts / item.totalAttempts) * 100)
          : 0;
      let intervalDays = 1;
      if (item.lastAttemptCorrect && item.sessions.size >= 2 && accuracy >= 95) intervalDays = 14;
      else if (item.lastAttemptCorrect && item.sessions.size >= 2 && accuracy >= 80) intervalDays = 7;
      else if (item.lastAttemptCorrect && item.sessions.size >= 2 && accuracy >= 60) intervalDays = 3;
      const lastTested = new Date(item.lastTestedAt);
      const nextReviewDate = localDateString(addCalendarDays(intervalDays, lastTested));

      const recentSessions = item.sessionOutcomes
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .slice(0, 2);
      const masteryStatus = recentSessions.length < 2
        ? 'unverified'
        : accuracy < 70
        ? 'developing'
        : accuracy >= 85 && recentSessions.every((session) => session.correct)
        ? 'mastered'
        : 'practicing';
      let status: SpacedTopic['status'] = 'upcoming';
      if (nextReviewDate < todayStr) {
        status = 'overdue';
      } else if (nextReviewDate === todayStr) {
        status = 'due_today';
      }

      return {
        concept: item.concept,
        subjectId: item.subjectId,
        chapterId: item.chapterId,
        subjectName: subjectNameMap.get(item.subjectId) || 'General',
        totalAttempts: item.totalAttempts,
        sessionsCount: item.sessions.size,
        successfulSessionsCount: item.successfulSessions.size,
        correctAttempts: item.correctAttempts,
        accuracy,
        lastTestedAt: item.lastTestedAt,
        nextReviewDate,
        status,
        masteryStatus,
        missedQuestionsCount: item.missedQuestionsCount,
      };
    });

    // Sort: weak & overdue first, then by mistake count descending
    return topics.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.missedQuestionsCount - a.missedQuestionsCount;
    });
  }

  /**
   * Generates prioritized, highly actionable recommendations based on real study data.
   */
  static generateRecommendations(
    attempts: QuizAttempt[],
    tasks: StudyTask[],
    flashcards: Flashcard[],
    materials: StudyMaterial[],
    subjects: Subject[]
  ): StudyRecommendation[] {
    const recommendations: StudyRecommendation[] = [];
    const todayStr = localDateString();
    const concepts = this.analyzeConcepts(attempts, subjects);

    // 1. Weak concepts with repeated mistakes (< 70% accuracy)
    const weakConcepts = concepts.filter((c) => c.accuracy < 70 && c.totalAttempts > 0);
    for (const weak of weakConcepts.slice(0, 2)) {
      const relatedMaterial = materials.find((m) => m.subjectId === weak.subjectId);
      recommendations.push({
        id: `rec-weak-${weak.concept.replace(/\s+/g, '-').toLowerCase()}`,
        type: 'review_concept',
        title: `Weak Concept: ${weak.concept}`,
        reason: `Measured accuracy is ${weak.accuracy}% with ${weak.missedQuestionsCount} missed question(s). Revisit the explanation.`,
        priority: 'urgent',
        actionLabel: 'Study Explanation',
        concept: weak.concept,
        subjectId: weak.subjectId,
        materialId: relatedMaterial?.id,
      });
    }

    // 2. Spaced Repetition Due Today or Overdue
    const dueTopics = concepts.filter((c) => c.status === 'due_today' || c.status === 'overdue');
    for (const due of dueTopics.slice(0, 2)) {
      recommendations.push({
        id: `rec-due-${due.concept.replace(/\s+/g, '-').toLowerCase()}`,
        type: 'spaced_revision',
        title: `Spaced Revision: ${due.concept}`,
        reason: `Interval reached (${due.status === 'overdue' ? 'Overdue' : 'Due today'}). Review now to solidify retention.`,
        priority: due.status === 'overdue' ? 'urgent' : 'recommended',
        actionLabel: 'Take Retest Quiz',
        concept: due.concept,
        subjectId: due.subjectId,
      });
    }

    // 3. Due Flashcards
    const dueFlashcards = flashcards.filter((f) => f.nextReviewDate <= todayStr);
    if (dueFlashcards.length > 0) {
      recommendations.push({
        id: 'rec-flashcards-due',
        type: 'spaced_revision',
        title: `${dueFlashcards.length} Flashcard${dueFlashcards.length > 1 ? 's' : ''} Ready for Review`,
        reason: 'Optimal spaced repetition intervals reached. Test your recall in under 3 minutes.',
        priority: 'recommended',
        actionLabel: 'Review Flashcards',
      });
    }

    // 4. Upcoming Deadlines with pending tasks
    const upcomingTasks = tasks
      .filter((t) => !t.completed && t.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (upcomingTasks.length > 0) {
      const topTask = upcomingTasks[0];
      const isDueSoon = topTask.dueDate <= todayStr;
      recommendations.push({
        id: `rec-task-${topTask.id}`,
        type: 'deadline_prep',
        title: `Upcoming Deadline: ${topTask.title}`,
        reason: isDueSoon
          ? 'Task is due today! Estimated time: ' + topTask.estimatedMinutes + ' mins.'
          : `Scheduled for ${topTask.dueDate}. Priority: ${topTask.priority.toUpperCase()}.`,
        priority: isDueSoon ? 'urgent' : 'recommended',
        actionLabel: 'Open Planner',
        taskId: topTask.id,
        subjectId: topTask.subjectId,
      });
    }

    // 5. If no attempts exist yet, recommend taking first quiz
    if (attempts.length === 0 && materials.length > 0) {
      recommendations.push({
        id: 'rec-first-quiz',
        type: 'retake_quiz',
        title: 'Calibrate Your Study Engine',
        reason: 'Generate a diagnostic quiz from your study material to measure baseline concept mastery.',
        priority: 'recommended',
        actionLabel: 'Generate Quiz',
        materialId: materials[0].id,
        subjectId: materials[0].subjectId,
      });
    }

    return recommendations;
  }

  /**
   * Identifies all unique missed questions across quiz history for the Missed Questions Vault.
   */
  static getMissedQuestionsHistory(attempts: QuizAttempt[]) {
    const missedList: {
      questionId: string;
      questionText: string;
      concept: string;
      subjectId: string;
      quizTitle: string;
      attemptDate: string;
      userAnswer?: string;
      correctAnswer: string;
      explanation: string;
    }[] = [];

    for (const attempt of attempts) {
      for (const ans of attempt.answers) {
        if (!ans.isCorrect) {
          missedList.push({
            questionId: ans.questionId,
            questionText: ans.questionText,
            concept: ans.concept,
            subjectId: attempt.subjectId,
            quizTitle: attempt.quizTitle,
            attemptDate: attempt.completedAt,
            userAnswer: ans.textAnswer || (ans.selectedOption !== undefined ? `Option ${ans.selectedOption + 1}` : undefined),
            correctAnswer: ans.correctAnswerText,
            explanation: ans.explanation,
          });
        }
      }
    }

    return missedList;
  }
}
