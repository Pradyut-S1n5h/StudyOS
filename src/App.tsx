/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { storage } from './services/storage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { LibraryView } from './components/library/LibraryView';
import { PlannerView } from './components/planner/PlannerView';
import { StudyLabView } from './components/studylab/StudyLabView';
import { RevisionView } from './components/revision/RevisionView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { StudyTimerModal } from './components/common/StudyTimerModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Navigation payload parameters
  const [navParams, setNavParams] = useState<{
    materialId?: string;
    subTab?: 'notes' | 'explain' | 'ask' | 'quiz';
    concept?: string;
    subjectId?: string;
  }>({});

  // Global Focus Timer state
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Initialize storage with sample curriculum on mount
  useEffect(() => {
    storage.init();
  }, []);

  // Background timer ticker
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Deep navigation handler
  const handleNavigate = (tab: string, params?: any) => {
    if (params) {
      setNavParams(params);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const subjects = storage.getSubjects();

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => handleNavigate(tab)}
        onOpenTimer={() => setIsTimerModalOpen(true)}
        isTimerRunning={isTimerRunning}
        timerSeconds={timerSeconds}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => handleNavigate(tab)}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab, params) => handleNavigate(tab, params)}
              onOpenTimer={() => setIsTimerModalOpen(true)}
            />
          )}

          {currentTab === 'library' && (
            <LibraryView
              initialSubjectId={navParams.subjectId}
              onNavigateToStudyLab={(materialId, action) =>
                handleNavigate('studylab', {
                  materialId,
                  subTab: action,
                })
              }
            />
          )}

          {currentTab === 'planner' && <PlannerView />}

          {currentTab === 'studylab' && (
            <StudyLabView
              initialMaterialId={navParams.materialId}
              initialSubTab={navParams.subTab || 'notes'}
              initialConcept={navParams.concept}
            />
          )}

          {currentTab === 'revision' && (
            <RevisionView
              initialConcept={navParams.concept}
              onStartRetest={(concept) =>
                handleNavigate('studylab', {
                  subTab: 'quiz',
                  concept,
                })
              }
            />
          )}

          {currentTab === 'analytics' && <AnalyticsView />}
        </main>
      </div>

      {/* Focus Timer Modal */}
      <StudyTimerModal
        isOpen={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
        isTimerRunning={isTimerRunning}
        setIsTimerRunning={setIsTimerRunning}
        timerSeconds={timerSeconds}
        setTimerSeconds={setTimerSeconds}
        subjects={subjects}
      />
    </div>
  );
}
