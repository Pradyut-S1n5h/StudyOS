# StudyOS — AI-Powered Personalized Student Operating System

> **Learn smarter. Plan better. Remember longer.**

StudyOS is a comprehensive, production-grade student productivity and cognitive learning platform designed to solve fragmented student workflows. Instead of juggling notes across one app, flashcards in another, quiz tools elsewhere, and calendars in a fourth, StudyOS merges these into a single unified operating system powered by the **Study Intelligence Engine**.

---

## 🚀 The Core Product Principle: Study Intelligence Engine

StudyOS implements the continuous, measurable learning cycle:

$$\text{STUDY MATERIAL} \longrightarrow \text{UNDERSTANDING} \longrightarrow \text{PRACTICE} \longrightarrow \text{PERFORMANCE ANALYSIS} \longrightarrow \text{SPACED REVISION} \longrightarrow \text{RETESTING}$$

### Key Intelligence Engine Capabilities:
1. **Measured Accuracy Tracking**: Calculates actual concept accuracy from diagnostic quiz questions, distinguishing measured scores from estimated mastery.
2. **Deterministic Spaced Repetition**: Concepts missed repeatedly reset to 1-day intervals; passing concepts advance to 3 days, and repeatedly mastered concepts (≥90% over multiple sessions) advance to 7 and 14 days.
3. **Adaptive Prioritization**: Cross-references impending task deadlines (within 48h) with identified weak concepts to flag actionable, urgent recommendations.
4. **Missed-Questions Vault**: Automatically archives every question answered incorrectly during diagnostics, providing 1-click targeted re-tests.

---

## 🌟 Key Application Sections

### 1. Dashboard
- **Personalized Header**: Study streak momentum tracker, daily goal progress, and one-click quick actions.
- **Adaptive Intelligence Feed**: Real-time recommendations prioritized by urgency (weak concept reviews, spaced recalls due today, deadline prep).
- **Weekly Focus Velocity**: True measured focus minutes bar chart over the last 7 days.
- **Priority Tasks & Weak Topics Radar**: Real-time summary of upcoming deadlines and topics needing attention.

### 2. My Library
- **Subject & Chapter Management**: Create, customize, color-code, and manage subjects and chapters.
- **Material Ingestion**: Paste lecture notes, or upload `.txt`, `.md`, or `.pdf` text documents with client-side text extraction.
- **Instant Study Lab Launchers**: Jump straight from any material into "Generate Notes", "Create Quiz", or "Ask Questions".

### 3. Study Planner
- **Full Task Lifecycle**: Subject, chapter, due date, estimated minutes, priority (High/Medium/Low), and completion status.
- **Filters**: Filter by Due Today, Upcoming, Completed, Subject, or Priority.
- **AI Smart Schedule Assistant**: Analyzes pending tasks, deadlines, and weak concepts to formulate an actionable, realistic daily study timetable.

### 4. AI Study Lab
- **Notes Generator**: Configurable styles including *Quick Revision*, *Detailed Academic Explanation*, *Key Definitions & Terminology*, *Formulas & Concepts*, and *Common Misconceptions*. Includes copy and save-to-library features.
- **Multi-Depth Explanation Mode**: Switch between *Beginner (ELI5 analogies)*, *Standard collegiate*, *Advanced (mechanisms & math)*, and *Step-by-Step* breakdowns.
- **Grounded Q&A**: Answers questions strictly using the active study material with citation indicators.
- **Diagnostic Quiz Generator**: Generates balanced 3, 4, or 6-question quizzes (MCQ and AI-evaluated Short Answer) in both *Test Mode* (timed submission) and *Practice Mode* (instant feedback).

### 5. Revision Center
- **Spaced Recall Queue**: Lists concepts due for review today based on measured forgetting curves.
- **Active Recall Flashcards**: Interactive 3D flip card deck with SM-2-inspired spaced repetition ratings (*Again*, *Hard*, *Good*, *Easy*).
- **Missed-Questions Vault**: Permanent record of every mistake made across quizzes, explaining the error and offering immediate practice.
- **Targeted Concept Retesting**: 1-click launch of focused quizzes for weak topics.

### 6. Performance Analytics
- **Verified Study Time**: Distinguishes between actual focus timer minutes and estimated task durations.
- **Quiz Accuracy Trajectory**: Chronological quiz score trends.
- **Subject Mastery Breakdown**: Subject-by-subject accuracy, completed tasks, and recorded study time.
- **Mastery Matrix**: Detailed concept breakdown showing mistake counts, accuracy, and mastery status.

### 7. Integrated Focus Timer
- Live Stopwatch/Pomodoro focus timer accessible from anywhere in the app.
- Logs actual focused minutes directly into the verified study session database.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Canvas Confetti |
| **Backend** | Node.js, Express, tsx |
| **AI Integration** | Google GenAI SDK (`@google/genai`), Gemini 3.8 Flash (`gemini-3.8-flash`) |
| **Persistence** | Structured local client-side database with JSON export/import and fallback resilience |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

```bash
# GEMINI_API_KEY: Required for Gemini AI API calls.
# AI Studio automatically injects this at runtime from user secrets.
GEMINI_API_KEY="your-gemini-api-key"

# Port (defaults to 3000)
PORT=3000
```

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run full-stack development server
npm run dev

# 3. Build for production
npm run build

# 4. Run production server
npm run start
```

---

## 🧪 Tested Workflows

- ✅ Full end-to-end learning loop: Study Material $\to$ Notes Generation $\to$ Diagnostic Quiz $\to$ Scoring & Recording $\to$ Weak Concept Detection $\to$ Spaced Repetition Queue $\to$ Flashcard Recall $\to$ Analytics update.
- ✅ Offline and fallback resilience: Works smoothly even if the AI key is offline, providing deterministic assistance.
- ✅ Sample curriculum toggle: Instant one-click switch between rich AP Biology & CS sample data and a completely fresh empty state.
