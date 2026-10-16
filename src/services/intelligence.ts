import {
  QuizAttempt,
  StudyTask,
  Flashcard,
  Subject,
  StudyMaterial,
  SpacedTopic,
  StudyRecommendation,
} from '../types';

export class StudyIntelligenceEngine {
  /**
   * Analyzes all quiz attempts across subjects to extract concept-level performance,
   * mistake frequency, and true measured accuracy.
   */
  static analyzeConcepts(
    attempts: QuizAttempt[],
    subjects: Subject[]
  ): SpacedTopic[] {
    const conceptMap: Record<
      string,
      {
        concept: string;
        subjectId: string;
        totalAttempts: number;
        correctAttempts: number;
        missedQuestionsCount: number;
        lastTestedAt: string;
      }
    > = {};

    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    // Aggregate through all recorded attempts
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const concept = answer.concept || 'General Review';
        if (!conceptMap[concept]) {
          conceptMap[concept] = {
            concept,
            subjectId: attempt.subjectId,
            totalAttempts: 0,
            correctAttempts: 0,
            missedQuestionsCount: 0,
            lastTestedAt: attempt.completedAt,
          };
        }

        conceptMap[concept].totalAttempts += 1;
        if (answer.isCorrect) {
          conceptMap[concept].correctAttempts += 1;
        } else {
          conceptMap[concept].missedQuestionsCount += 1;
        }

        if (new Date(attempt.completedAt) > new Date(conceptMap[concept].lastTestedAt)) {
          conceptMap[concept].lastTestedAt = attempt.completedAt;
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const topics: SpacedTopic[] = Object.values(conceptMap).map((item) => {
      const accuracy =
        item.totalAttempts > 0
          ? Math.round((item.correctAttempts / item.totalAttempts) * 100)
          : 0;

      // Deterministic spaced repetition intervals based on accuracy:
      // < 60%: 1 day
      // 60-79%: 3 days
      // 80-94%: 7 days
      // >= 95%: 14 days
      let intervalDays = 1;
      if (accuracy >= 95) intervalDays = 14;
      else if (accuracy >= 80) intervalDays = 7;
      else if (accuracy >= 60) intervalDays = 3;
      else intervalDays = 1;

      const lastTested = new Date(item.lastTestedAt);
      const nextDate = new Date(lastTested);
      nextDate.setDate(nextDate.getDate() + intervalDays);
      const nextReviewDate = nextDate.toISOString().split('T')[0];

      let status: 'overdue' | 'due_today' | 'upcoming' | 'mastered' = 'upcoming';
      if (accuracy >= 90 && item.totalAttempts >= 3) {
        status = 'mastered';
      } else if (nextReviewDate < todayStr) {
        status = 'overdue';
      } else if (nextReviewDate === todayStr) {
        status = 'due_today';
      }

      return {
        concept: item.concept,
        subjectId: item.subjectId,
        subjectName: subjectNameMap.get(item.subjectId) || 'General',
        totalAttempts: item.totalAttempts,
        correctAttempts: item.correctAttempts,
        accuracy,
        lastTestedAt: item.lastTestedAt,
        nextReviewDate,
        status,
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
    const todayStr = new Date().toISOString().split('T')[0];
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
