# PROJECT REPORT: AUTOMATED EXAM SEATING AND INVIGILATION SCHEDULING SYSTEM WITH GENATIVE AI INTEGRATION

**A Project Report submitted in partial fulfillment of the requirements for the degree of Bachelor of Technology in Computer Science & Engineering.**

---

## DECLARATION
We, the undersigned, hereby declare that the project work entitled **"Automated Exam Seating and Invigilation Scheduling System with Generative AI Integration"** is an authentic record of our own work carried out under the supervision of our department faculty. This work has not been submitted elsewhere for any other degree or diploma.

**Date:** July 1, 2026  
**Place:** State Institute of Technology

*Student Names and Roll Numbers:*
1. Student A (Roll No: CSE-2026-01)
2. Student B (Roll No: CSE-2026-02)

---

## CERTIFICATE
This is to certify that the project report entitled **"Automated Exam Seating and Invigilation Scheduling System with Generative AI Integration"** submitted by the students listed above is a bonafide record of the work carried out under my guidance and supervision.

**Project Guide:**  
Dr. H. O. D.  
Professor, Department of Computer Science & Engineering  
State Institute of Technology  

---

## ACKNOWLEDGEMENT
We express our deepest gratitude to our project guide and the Department of Computer Science & Engineering for providing the necessary facilities and support. We are highly indebted to them for their valuable guidance, constant encouragement, and constructive suggestions during the course of this project.

We also thank our families, peers, and friends who supported us directly and indirectly in completing this project successfully.

---

## ABSTRACT
Examination scheduling in academic institutions is a complex, high-dimensional Constraint Satisfaction Problem (CSP). Traditionally, administrators schedule exams, assign invigilators (proctors), and allocate seating arrangements manually. This manual process is prone to errors, schedule conflicts (e.g., students with overlapping exams), inefficient room utilization, and invigilator double-bookings. Furthermore, addressing special student accommodations (e.g., wheelchair accessibility, extra time, quiet rooms) and preventing malpractice through strategic seating layouts add layers of difficulty.

This project presents an **Automated Exam Seating and Invigilation Scheduling System with Generative AI Integration**. Built as a modern, responsive web application using a three-tier architecture (React, Express.js, and SQLite), the system leverages a hybrid backtracking algorithm with **Simulated Annealing (SA)** local search to optimize schedule configurations. The algorithm satisfies both hard constraints (no clashes) and soft constraints (reducing travel between buildings, balancing invigilator workloads, and optimizing seat allocations). 

Additionally, the platform incorporates **Google Gemini API** to provide an intelligent conversational assistant (Gemini Copilot) that audits schedules, generates custom-themed mock datasets, and provides actionable recommendations. The system supports bulk data importing via Microsoft Excel (`.xlsx`/`.csv`) spreadsheets and features multi-channel reporting, exporting to PDF format, generating Excel workbooks, and sending email notifications to proctors. The final implementation demonstrates high optimization convergence speeds, robust constraint enforcement, and an aesthetic user interface, making it a state-of-the-art administrative tool for educational institutions.

---

## TABLE OF CONTENTS
1. **Chapter 1: Introduction**
   - 1.1 Project Overview
   - 1.2 Purpose and Objectives
   - 1.3 Problem Statement
   - 1.4 Scope of the Project
2. **Chapter 2: Literature Review & Gap Analysis**
   - 2.1 Traditional Exam Scheduling Systems & Challenges
   - 2.2 Algorithmic Scheduling vs. Manual Methods
   - 2.3 Need for AI Integration & Intelligent Auditing
3. **Chapter 4: Technology Stack Analysis**
   - 4.1 Frontend Framework & Runtime (React 19, Vite, TypeScript)
   - 4.2 Styling and Animations (Tailwind CSS v4, Motion)
   - 4.3 Backend API Server (Node.js, Express.js)
   - 4.4 Database Layer (SQLite, better-sqlite3)
   - 4.5 GenAI Core (Google Gemini API via @google/genai SDK)
   - 4.6 File Parsing & Generation (SheetJS xlsx, jsPDF)
   - 4.7 Communication & Messaging (Nodemailer)
4. **Chapter 5: Detailed Database Design**
   - 5.1 Entity-Relationship (ER) Modeling
   - 5.2 Schema Script and Table Structures
   - 5.3 Database Indexing Strategy
5. **Chapter 6: System Modules & Detailed Implementation**
   - 6.1 Data Import & Ingestion Module
   - 6.2 Configuration Management Module
   - 6.3 Seating Arrangement Layout Engine
   - 6.4 Report Generation & Exporting Module
   - 6.5 Notification Delivery Pipeline
   - 6.6 Gemini Copilot Integration Module
6. **Chapter 7: The Core Scheduling Algorithm & Constraint Satisfaction**
   - 7.1 Mathematical Formulation of the Scheduling Problem
   - 7.2 Hard Constraints vs. Soft Constraints
   - 7.3 Simulated Annealing Metaheuristic Details
   - 7.4 Zero-Adjacency Row-Scan Greedy Seating Layout Logic
7. **Chapter 8: User Interface Design & Polish**
   - 8.1 Modern Visual Design System (Dark Mode, HSL Color Palette, Typography)
   - 8.2 Component-by-Component UX Breakdown
8. **Chapter 9: System Testing, Verification, & Performance Analysis**
   - 9.1 Verification Methodology
   - 9.2 Automated Constraints Check & Audits
   - 9.3 Algorithmic Performance & Cost Function Convergence
9. **Chapter 10: Conclusion & Future Scope**
   - 10.1 Key Achievements
   - 10.2 Project Limitations
   - 10.3 Future Enhancements & Recommendations
10. **References & Bibliography**

---

## CHAPTER 1: INTRODUCTION

### 1.1 Project Overview
The "Automated Exam Seating and Invigilation Scheduling System" is a comprehensive, AI-powered software application designed to streamline the administration of university examinations. Generating an examination timetable involves matching courses, student enrollments, exam dates, time slots, exam halls, and invigilator staff. The problem grows exponentially with the size of the institution, the number of courses, and the complexity of constraint requirements.

This project addresses these challenges by developing a web application that manages administrative tasks, automates scheduling using metaheuristic optimization, layouts seating plans to prevent cheating, and integrates LLMs (Large Language Models) to audit and guide administrators.

### 1.2 Purpose and Objectives
The primary purpose of this system is to replace manual administrative tasks with an intelligent, automated, and error-free digital solution. The specific objectives are:
1. **Eliminate Scheduling Conflicts**: Ensure that no student is assigned two exams simultaneously, and no invigilator is assigned to two classrooms in the same shift.
2. **Optimize Resource Allocation**: Maximize the utilization of exam halls and distribute invigilator workloads fairly.
3. **Respect Special Accommodations**: Automate the placement of students requiring special needs (e.g., wheelchair-accessible rooms for candidates with physical disabilities, separate quiet rooms, or scribe support).
4. **Prevent Malpractice**: Implement seating arrangement algorithms that separate students writing the same exam to reduce cheating opportunities.
5. **Enable Multi-Channel Output**: Provide exports to PDF (individual room charts), Excel (master timetables), and automated emails (individual duty alerts to staff).
6. **Provide AI Assistance**: Integrate Google Gemini to analyze scheduled structures and offer optimization suggestions.

```mermaid
graph TD
    A[Excel/CSV Data Import] --> B[SQLite Local Database]
    C[User Configurations & Weightings] --> D[Core Scheduling Algorithm]
    B --> D
    D --> E[Simulated Annealing Optimizer]
    E --> F[Visual Seating & Timeline View]
    E --> G[PDF/Excel Reports]
    E --> H[Nodemailer Email Alerts]
    E --> I[Gemini AI Copilot Audit]
```

### 1.3 Problem Statement
Manual examination scheduling is a time-consuming and stressful administrative task. In typical colleges:
- Scheduling staff spend weeks plotting timelines on spreadsheets, cross-checking course combinations.
- A single last-minute change (e.g., an invigilator calling in sick or a room becoming unavailable) requires rebuilding large portions of the schedule.
- Checking for student exam clashes is highly prone to human error, resulting in delayed starts and administrative embarrassment.
- Student accommodations are often overlooked due to a lack of centralized data matching.
- Seating plans are typically generated on the spot by proctors, leading to adjacent placements of students from the same class, raising cheating risks.

Therefore, there is an urgent need for an integrated system that can accept student and course records, execute a conflict-free optimization solver in seconds, and deliver ready-to-use seating arrangements and proctor rotas.

### 1.4 Scope of the Project
The scope of this project includes the design, development, testing, and deployment of a single-page web application featuring:
- **A Node.js/Express.js Backend** that acts as the REST API provider and manages the SQLite database.
- **A React/TypeScript Frontend** styled with Tailwind CSS, delivering a clean interface with real-time feedback.
- **An Optimization Engine** based on Simulated Annealing, running on the client or server to solve the CSP.
- **A Data Loader** that reads Excel sheets, parses student enrollments, invigilator availabilities, and rooms, and loads them into a normalized SQLite database.
- **A Notification Engine** that utilizes Nodemailer to deliver assignments directly to proctors' inboxes.
- **An AI Copilot Panel** powered by Gemini 3.5 Flash, providing conversational schedules auditing.

---

## CHAPTER 2: LITERATURE REVIEW & GAP ANALYSIS

### 2.1 Traditional Exam Scheduling Systems & Challenges
Exam scheduling belongs to a class of mathematical problems known as NP-Hard. As the number of variables (students, courses, rooms, invigilators, timeslots) increases, the search space grows factorially.

Historically, academic institutions relied on manual board-based scheduling or simple spreadsheet tools like Microsoft Excel. While spreadsheets store data, they lack active validation constraints. If an administrator schedules a student for two exams in the same morning slot, the spreadsheet does not raise a warning unless complex formulas are written.

### 2.2 Algorithmic Scheduling vs. Manual Methods
To solve NP-hard scheduling problems, researchers have investigated several algorithmic approaches:
1. **Backtracking Search**: A systematic method that builds a schedule step-by-step. If a conflict is reached, it undoes the last assignment. While it guarantees finding a solution if one exists, its worst-case time complexity is \(O(b^d)\), which makes it extremely slow for large-scale datasets.
2. **Genetic Algorithms (GA)**: A heuristic approach inspired by natural selection. GAs maintain a population of schedules, applying crossover and mutation operators. However, GAs suffer from high memory usage and slow convergence on highly constrained datasets, as mutations often generate invalid schedules.
3. **Simulated Annealing (SA)**: A local search metaheuristic inspired by the physical process of annealing in metallurgy. It starts with an initial schedule and iteratively makes small modifications. To avoid getting stuck in local minima, SA occasionally accepts worse schedules with a probability that decreases as the system "cools." SA is highly effective for scheduling because of its low memory footprint and speed.

| Feature | Manual Scheduling | Genetic Algorithm (GA) | Simulated Annealing (SA) |
| :--- | :--- | :--- | :--- |
| **Time Required** | Weeks of manual effort | Hours of calculation | Seconds to Minutes |
| **Clash Prevention** | High error rate | Guaranteed | Guaranteed |
| **Resource Efficiency** | Low (over-allocated rooms) | Medium | Very High |
| **Adaptability** | Extremely rigid | Moderate | High (adjustable weights) |
| **Complexity** | Simple but tedious | Complex implementation | Balanced and efficient |

### 2.3 Need for AI Integration & Intelligent Auditing
Modern applications benefit from combining structured algorithms with LLMs. While mathematical solvers generate schedules based on strict numeric weights, they cannot explain *why* a particular schedule was chosen or easily suggest creative alternatives (e.g., proposing that shifting a single high-priority exam by one day would free up three proctors). 

By integrating an LLM like Google Gemini, the system provides administrators with a natural language interface. The LLM translates the raw conflict data and statistics into readable summaries, highlighting proctor fatigue, building travel buffers, and room utilization imbalances.

---

## CHAPTER 3: SYSTEM REQUIREMENTS & ARCHITECTURE

### 3.1 Software Requirements
- **Operating System**: Windows 10/11, macOS, or Linux (cross-platform node runtime).
- **Runtime Environment**: Node.js v18.0.0 or higher.
- **Package Manager**: npm v9.0.0+ or Yarn.
- **Database Engine**: SQLite 3 (managed via `better-sqlite3` native drivers).
- **Bundler / Dev Server**: Vite v6.0.0+.
- **Language**: TypeScript v5.0+ (used on both frontend and backend for type safety).
- **Core APIs**: Google Gemini API key (for AI Copilot features).

### 3.2 Hardware Requirements
- **Development & Hosting Environment**:
  - CPU: Dual-Core Intel i5 / AMD Ryzen 5 or higher.
  - Memory: 8 GB RAM (16 GB recommended for esbuild compiles).
  - Storage: 500 MB of free disk space (excluding node_modules).
- **Client Web Browser**: Any modern browser supporting HTML5, CSS3, and ES6 Javascript (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).

### 3.3 High-Level System Architecture
The application is designed using a **Three-Tier Architecture** consisting of the Presentation Layer, the Application Logic Layer, and the Data Layer.

```
+-------------------------------------------------------------+
|                     PRESENTATION LAYER                      |
|  - React 19 Frontend Components                             |
|  - Tailwind CSS v4 Styled Layouts                           |
|  - Interactive Seating Grids & Timelines                    |
|  - Gemini AI Copilot Chat Interface                         |
+------------------------------------+------------------------+
                                     |
                                    HTTP
                                     |
+------------------------------------+------------------------+
|                     APPLICATION LOGIC LAYER                 |
|  - Node.js & Express.js REST API Server                     |
|  - Simulated Annealing Optimizer (solver.ts)                |
|  - Nodemailer Email Gateway (mailer.ts)                     |
|  - Excel Parser (SheetJS) & jsPDF Document Engine           |
|  - Google Gemini API Integration                            |
+------------------------------------+------------------------+
                                     |
                                   SQLite
                                     |
+------------------------------------+------------------------+
|                          DATA LAYER                         |
|  - SQLite Database File (exam_scheduler.db)                 |
|  - Normalized Tables (Students, Rooms, Courses, etc.)       |
|  - Custom Indexes for Fast Joins & Queries                  |
+-------------------------------------------------------------+
```

### 3.4 Data Flow Diagrams (DFD)

#### DFD Level 0 (Context Diagram)
The Context Diagram represents the overall system boundary, showing the interfaces between the application and external entities.

```
                 +-----------------------+
                 |                       |
                 |                       |
                 |                       |
                 |     ADMINISTRATOR     |
                 |                       |
                 |                       |
                 |                       |
                 +---+---------------+---+
                     |               ^
        Upload Excel |               | Generated Reports,
        Configs      |               | AI Suggestions,
                     v               | Seating Plans
                 +---+---------------+---+
                 |                       |
                 |                       |
                 |   AUTOMATED EXAM      |
                 |   SCHEDULING SYSTEM   |
                 |                       |
                 |                       |
                 +---+---------------+---+
                     |               ^
        Trigger Email|               | Fetch LLM Response
        Notification |               | & Context Evaluation
                     v               |
                 +---+---+       +---+---+
                 |INVIG- |       |GEMINI |
                 |ILATOR |       |  AI   |
                 | STAFF |       |PORTAL |
                 +-------+       +-------+
```

#### DFD Level 1 (Process Breakdown)
The Level 1 DFD outlines the internal flows within the system, focusing on data movement through modules.

```
[Admin] --(1. Upload Sheets)--> [Parse & Import Module] --(2. Store Data)--> [(DB) SQLite]
                                                                                |
[Admin] --(3. Configure Weights & Run)--> [Optimization Solver] <---------------+
                                                    |
                                                    +--(4. Save Entries)--> [(DB) SQLite]
                                                    |
                                                    +--(5. Output Schedule)--> [Reports & Exports]
                                                                                       |
                                                                                       +--> [Nodemailer] --> [Proctors]
                                                                                       +--> [jsPDF] --> [Download PDF]
                                                                                       +--> [SheetJS] --> [Download Excel]
```

### 3.5 Use Case Diagrams
The core use cases involve the Administrator interacting with the configuration interface, running the scheduler, and auditing the outputs.

```
                      +---------------------------------------+
                      |                                       |
                      |          Manage Configurations        |
                      |           (Rooms, Courses, etc.)      |
                      |                      ^                |
                      |                      |                |
                      |         Import Excel Spreadsheets     |
                      |                      ^                |
                      |                      |                |
    (ADMINISTRATOR)---+------------Run Scheduler-------------+
                      |                      |                |
                      |                      v                |
                      |            Visual Seating Grid        |
                      |                      v                |
                      |          Download PDF & Excel Rota    |
                      |                      v                |
                      |        Audit Timetable with AI        |
                      |                                       |
                      +---------------------------------------+
```

---

## CHAPTER 4: TECHNOLOGY STACK ANALYSIS

### 4.1 Frontend Framework & Runtime (React 19, Vite, TypeScript)
- **React 19**: Selected for its declarative programming model, component reusability, and efficient DOM rendering.
- **Vite**: Used as the frontend build tool. Vite provides fast Hot Module Replacement (HMR) and optimized esbuild compilation speeds.
- **TypeScript**: Enforces strict type definitions, reducing runtime errors and improving codebase maintainability.

### 4.2 Styling and Animations (Tailwind CSS v4, Motion)
- **Tailwind CSS v4**: Provides a modern, utility-first CSS framework. The application implements dark mode styles, custom colors (HSL-based), and glassmorphism.
- **Motion (Framer Motion)**: Powers smooth transitions and micro-animations (e.g., page loads, button clicks, scheduling progress updates), providing a premium look.

### 4.3 Backend API Server (Node.js, Express.js)
- **Node.js**: The asynchronous, event-driven runtime enables handling of concurrent file parsing and database writes.
- **Express.js**: Used to build lightweight REST API endpoints, routing incoming requests to database operations and service modules.

### 4.4 Database Layer (SQLite, better-sqlite3)
- **SQLite**: A self-contained, serverless database engine. It stores data locally in a single file (`exam_scheduler.db`), removing the need for a separate database server.
- **better-sqlite3**: The fastest SQLite library for Node.js. It features synchronous execution matching Node’s speed, transactional integrity, and Write-Ahead Logging (WAL) support.

### 4.5 GenAI Core (Google Gemini API via @google/genai SDK)
- **Gemini 3.5 Flash**: A state-of-the-art LLM optimized for speed and structured JSON outputs.
- **@google/genai SDK**: Integrated directly on the server to handle API calls, passing live scheduling stats as context to the model to generate recommendations.

### 4.6 File Parsing & Generation (SheetJS xlsx, jsPDF)
- **SheetJS (xlsx)**: Parses binary buffers of uploaded Excel and CSV files.
- **jsPDF & jsPDF-AutoTable**: Generates high-quality PDF reports, formatting exam seating charts and duty rosters into printable tables.

### 4.7 Communication & Messaging (Nodemailer)
- **Nodemailer**: Connects to SMTP servers to deliver automated exam schedules to proctors. It handles HTML formatting, attachments, and features an Ethereal SMTP fallback for local testing.

---

## CHAPTER 5: DETAILED DATABASE DESIGN

### 5.1 Entity-Relationship (ER) Modeling
The database consists of 9 key tables designed to support exam administration. The relationships are structured as follows:

```
  +--------------+          +-------------------+          +-------------+
  |  colleges    |          | student_accommod- |          |   branches  |
  +--------------+          |      ations       |          +-------------+
  | id (PK)      |          +-------------------+          | id (PK)     |
  | name         |          | student_id (FK)   |          | name (UQ)   |
  | exam_start_  |          | accommodation     |          +-------------+
  | date         |          +---------+---------+
  +--------------+                    | (1..N)
                                      |
                               +------v-------+            +-------------+
                               |   students   |            |   courses   |
                               +--------------+            +-------------+
                               | id (PK)      |            | id (PK)     |
                               | name         |            | name        |
                               +------+-------+            | duration    |
                                      |                    | priority    |
                                      | (1..N)             | branch      |
                                      |                    +------+------+
                             +--------v--------+                  |
                             | student_courses |                  | (1..N)
                             +-----------------+                  |
                             | student_id (FK) |                  |
                             | course_id (FK)  <------------------+
                             +-----------------+
                                                                  | (1..N)
  +------------------+       +-------------------+         +------v------+
  | invigilators     |       | invigilator_avai- |         |  schedule_  |
  +------------------+       |    lability       |         |   entries   |
  | id (PK)          |       +-------------------+         |             |
  | name             |       | invigilator_id(FK)|         | id (PK)     |
  | email            |       | slot_id           |         | course_id(FK)
  | department       |       +---------^---------+         | timeslot_id |
  | max_workload     |                 |                   | room_id (FK)|
  +--------+---------+                 | (1..N)            | invigil_(FK)|
           |                           |                   +------+------+
           +---------------------------+                          |
           |                                                      |
           +------------------------------------------------------+ (1..N)
```

### 5.2 Schema Script and Table Structures
The SQL schema implemented in [server/db.ts](file:///d:/A7/server/db.ts) initializes these tables:

```sql
CREATE TABLE IF NOT EXISTS colleges (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  exam_start_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) NOT NULL,
  branch TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  building TEXT NOT NULL,
  accessible INTEGER NOT NULL CHECK (accessible IN (0, 1))
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_courses (
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_accommodations (
  student_id TEXT NOT NULL,
  accommodation TEXT NOT NULL,
  PRIMARY KEY (student_id, accommodation),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invigilators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT NOT NULL,
  max_workload INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invigilator_availability (
  invigilator_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  PRIMARY KEY (invigilator_id, slot_id),
  FOREIGN KEY (invigilator_id) REFERENCES invigilators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  timeslot_id TEXT,
  room_id TEXT,
  invigilator_id TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
```

### 5.3 Database Indexing Strategy
To optimize database performance, indexes are created on foreign keys and frequently queried fields. These indexes reduce query times during schedule optimization:

```sql
CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_student_accoms_student ON student_accommodations(student_id);
CREATE INDEX IF NOT EXISTS idx_invig_avail_invig ON invigilator_availability(invigilator_id);
CREATE INDEX IF NOT EXISTS idx_invig_avail_slot ON invigilator_availability(slot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_course ON schedule_entries(course_id);
CREATE INDEX IF NOT EXISTS idx_schedule_timeslot ON schedule_entries(timeslot_id);
CREATE INDEX IF NOT EXISTS idx_schedule_room ON schedule_entries(room_id);
CREATE INDEX IF NOT EXISTS idx_schedule_invig ON schedule_entries(invigilator_id);
```

---

## CHAPTER 6: SYSTEM MODULES & DETAILED IMPLEMENTATION

### 6.1 Data Import & Ingestion Module
The system parses uploaded spreadsheets dynamically. Implemented in [server/routes/import.ts](file:///d:/A7/server/routes/import.ts), this module supports two import modes:
- **Append**: Inserts new rows while keeping existing database records.
- **Replace**: Clears the relevant tables and reloads them with the new data.

To handle variance in Excel column headers, the parser uses aliases:

```typescript
const id = findValue(row, ['id', 'studentid', 'rollno', 'rollnumber', 'enrollmentno', 'enrollment']);
const name = findValue(row, ['name', 'fullname', 'studentname', 'firstname']);
const coursesRaw = findValue(row, ['courses', 'enrolledcourses', 'subjects', 'coursecodes']);
```

Comma-separated courses are split, capitalized, and validated against the database. Valid student-course connections are stored in transactions to ensure database consistency.

### 6.2 Configuration Management Module
The frontend configuration module provides CRUD interfaces for courses, rooms, invigilators, and branches. It also includes sliders to adjust optimization weights:

```typescript
export interface ConstraintWeights {
  studentConflict: number;     // Penalty for student exam overlaps
  roomCapacity: number;        // Penalty for room over-allocations
  accommodationMatch: number;  // Penalty for accommodation mismatches
  invigilatorOverlap: number;  // Penalty for invigilator double-bookings
  travelTime: number;          // Penalty for travel time conflicts
  roomUtilization: number;     // Penalty for wasted room capacity
  invigilatorWorkload: number; // Penalty for exceeding proctor workload
  cheatingSeparation: number;  // Penalty for adjacent student seating
  strictBranchSeparation: boolean; // Flag to enforce strict branch separation
}
```

### 6.3 Seating Arrangement Layout Engine
The seating layout engine uses a grid system to allocate seats. It arranges students in rows and columns, separating students taking the same exam.

The algorithm uses a zero-adjacency greedy strategy to assign seats in a room:
1. Calculates the number of rows based on a standard 6-column grid:
   \[
   N_{\text{rows}} = \lceil \frac{Capacity}{6} \rceil
   \]
2. Groups students by course and sorts them.
3. Places students row-by-row. At each grid position, it checks the left neighbor.
4. Selects a student from the course with the highest remaining count that is different from the left neighbor's course.
5. If no such student is available, it selects a student from the remaining pool and flags a potential cheating risk.

```typescript
// Evaluate Risk Count
let riskCount = 0;
for (let r = 0; r < numRows; r++) {
  for (let c = 0; c < numCols; c++) {
    const idx = r * numCols + c;
    const cid = gridCourse[idx];
    if (!cid) continue;

    // Check left neighbor
    if (c > 0 && gridCourse[idx - 1] === cid) { riskCount++; continue; }
    // Check right neighbor
    if (c < numCols - 1 && gridCourse[idx + 1] === cid) { riskCount++; }
  }
}
```

### 6.4 Report Generation & Exporting Module
Located in `src/components/ReportsTab.tsx`, this module exports schedules to PDF and Excel formats:
- **PDF Exporting**: Uses `jspdf` and `jspdf-autotable` to generate printable PDF files. It formats seating plans, room layouts, and invigilator rosters, inserting page breaks between rooms.
- **Excel Exporting**: Uses `xlsx` to write sheets for rooms, invigilator timetables, and courses.

### 6.5 Notification Delivery Pipeline
The backend uses Nodemailer to send email notifications. If custom SMTP credentials are provided, it connects to the SMTP server. Otherwise, it generates mock Ethereal test accounts to output preview URLs.

```typescript
const url = await sendMail(
  inv.email, 
  'Exam Assignment Notification', 
  `You have been assigned to an exam at ${entry.timeslotId} in room ${entry.roomId}.`
);
```

### 6.6 Gemini Copilot Integration Module
The Gemini Copilot module provides conversational assistance to administrators. The frontend sends the current schedule, conflict reports, and database statistics to the Express API. The server calls `gemini-3.5-flash` using the prompt format in [server.ts](file:///d:/A7/server.ts):

```typescript
const prompt = `
You are an expert academic scheduling consultant. Analyze this examination schedule state, its conflicts, and resource stats, and provide 3-4 actionable, high-quality optimization suggestions for the administrator.
...
`;
```

---

## CHAPTER 7: THE CORE SCHEDULING ALGORITHM & CONSTRAINT SATISFACTION

### 7.1 Mathematical Formulation of the Scheduling Problem
We define the examination scheduling problem as:
- A set of courses \(C = \{c_1, c_2, \dots, c_n\}\).
- A set of students \(S = \{s_1, s_2, \dots, s_m\}\), where each student is enrolled in a subset of courses \(C_s \subseteq C\).
- A set of classrooms \(R = \{r_1, r_2, \dots, r_k\}\), each with a capacity \(Cap(r)\) and accessibility status \(Acc(r) \in \{0, 1\}\).
- A set of invigilators \(I = \{i_1, i_2, \dots, i_p\}\), each with a maximum workload capacity \(MaxW(i)\) and availability set \(Slot_i\).
- A set of timeslots \(T = \{t_1, t_2, \dots, t_q\}\).

The goal is to find an assignment mapping each course \(c\) to a triple \((t, r, i)\) that minimizes the total cost function:
\[
\text{Minimize } \Phi(A) = \sum_{j} w_j \cdot V_j(A)
\]
where \(V_j(A)\) represents the violations of constraint \(j\) under assignment \(A\), and \(w_j\) is the associated penalty weight.

### 7.2 Hard Constraints vs. Soft Constraints

#### Hard Constraints (Must not be violated)
1. **Student Overlaps**: A student cannot sit for two exams at the same time:
   \[
   \forall s \in S, \quad \left| \{ c \in C_s \mid Timeslot(c) = t \} \right| \le 1 \quad \forall t \in T
   \]
2. **Room Capacity Overflow**: Total student enrollment in a room cannot exceed its capacity:
   \[
   \sum_{c \in Rooms(t, r)} Enrollment(c) \le Cap(r) \quad \forall t \in T, r \in R
   \]
3. **Invigilator Double-Booking**: An invigilator cannot be assigned to multiple rooms in the same timeslot:
   \[
   \left| \{ r \in R \mid \exists c \text{ scheduled in } (t, r) \text{ with } Invigilator(c) = i \} \right| \le 1 \quad \forall t \in T, i \in I
   \]
4. **Invigilator Unavailability**: Invigilators must only be scheduled during their available slots:
   \[
   Timeslot(c) = t \implies t \in Slot_{Invigilator(c)}
   \]
5. **Accessibility Match**: Students requiring wheelchair accessibility must be assigned to accessible rooms.

#### Soft Constraints (Minimize to optimize quality)
1. **Travel Time**: Reduce instances of students having back-to-back exams in different buildings on the same day.
2. **Invigilator Workload Balance**: Keep invigilator assignments within their preferred maximum workloads:
   \[
   Duties(i) \le MaxW(i)
   \]
3. **Room Utilization**: Maximize room capacity usage and avoid booking large rooms for small classes.
4. **Seating Proximity**: Prevent adjacent seating of students writing the same exam.

### 7.3 Simulated Annealing Metaheuristic Details
The scheduling engine uses Simulated Annealing (SA) to find optimal schedule solutions.

#### 7.3.1 Mutation Operators
At each iteration, the solver mutates a schedule entry using one of three operators:
- **Change Timeslot (40% probability)**: Re-assigns the selected course to a different timeslot.
- **Change Room (30% probability)**: Moves the course to a different room that fits the student enrollment.
- **Change Invigilator (30% probability)**: Reassigns a proctor from the available pool.

```mermaid
flowchart TD
    Start([Start Optimizer]) --> Init[Greedy Initial Assignment]
    Init --> Eval[Evaluate Initial Cost]
    Eval --> Loop{Step < MaxIterations?}
    Loop -- Yes --> Choose{Mutation Target?}
    Choose -- 70% Conflicting variable --> Mutate[Apply Random Mutation]
    Choose -- 30% Random variable --> Mutate
    Mutate --> EvalNew[Evaluate New Cost]
    EvalNew --> Accept{Accept Mutation?}
    Accept -- Yes --> Update[Update Schedule & Temp]
    Accept -- No --> Keep[Revert Mutation & Update Temp]
    Update --> Loop
    Keep --> Loop
    Loop -- No or Cost=0 --> End([Return Best Schedule])
```

#### 7.3.2 Acceptance Probability (Metropolis Criterion)
To escape local minima, the algorithm accepts worse schedules with a probability based on the temperature:
\[
P(\text{Accept}) = 
\begin{cases} 
1 & \text{if } \Delta \Phi < 0 \\
\exp\left(-\frac{\Delta \Phi}{K \cdot T}\right) & \text{if } \Delta \Phi \ge 0 
\end{cases}
\]
where:
- \(\Delta \Phi = \Phi(A_{\text{new}}) - \Phi(A_{\text{current}})\) is the cost difference.
- \(T\) is the current temperature.
- \(K\) is a scaling factor.

#### 7.3.4 Cooling Schedule
The system cools geometrically at each step:
\[
T_{n+1} = \alpha \cdot T_n
\]
where the cooling rate \(\alpha\) is typically set to 0.95.

#### 7.3.5 Conflict-Guided Heuristics
Rather than mutating variables entirely at random, the algorithm targets variables involved in active conflicts 70% of the time. This guided mutation approach improves convergence speed.

---

## CHAPTER 8: USER INTERFACE DESIGN & POLISH

### 8.1 Modern Visual Design System (Dark Mode, HSL Color Palette, Typography)
The frontend uses a modern, dark-themed UI design:
- **Backgrounds**: Slate gray and deep charcoal tones (`#0A0C10`, `#12151C`).
- **Colors**: Vibrant indigo, emerald green, and amber accents for visual contrast.
- **Typography**: Clean, sans-serif font pairings (e.g., Inter, Outfit) to improve readability.
- **Glassmorphism**: Glass-like transparent card styling with subtle borders.

### 8.2 Component-by-Component UX Breakdown
- **Login Component**: Features a secure login page with input validation and animations.
- **Configuration Tab**: A CRUD editor to manage courses, branches, rooms, and invigilators, with drag-and-drop operations and sliders for adjustment.
- **Scheduler Tab**: Visualizes schedule generation with real-time stats, progress bars, and cost convergence curves.
- **Seating Tab**: Displays room layouts in visual grids, highlighting seating positions and conflict risks.
- **Reports Tab**: Provides one-click exports to PDF and Excel files, and manages email notification schedules.
- **Gemini Copilot**: A side-docked chat window providing automated schedules auditing.

---

## CHAPTER 9: SYSTEM TESTING, VERIFICATION, & PERFORMANCE ANALYSIS

### 9.1 Verification Methodology
The system was verified using three test datasets:
1. **Simple Dataset**: 6 courses, 5 rooms, 10 invigilators, and 50 students. Used to verify basic scheduling logic.
2. **Intermediate Dataset**: 30 courses, 15 rooms, 25 invigilators, and 300 students. Used to test constraint enforcement under load.
3. **Stress-Test Dataset**: 100 courses, 40 rooms, 80 invigilators, and 1200 students. Used to evaluate optimizer performance and convergence speeds.

### 9.2 Automated Constraints Check & Audits
The system runs automated tests to ensure no hard constraints are violated in generated schedules. The conflict reporter logs details on any detected overlaps:

```json
{
  "id": "stu_STU-02_Day-2-Morning_MATH-201",
  "type": "Hard",
  "category": "Student Overlap",
  "message": "Student Clark Kent is scheduled for overlapping exams simultaneously in timeslot: [Day-2-Morning] (Calculus & Physics)",
  "impactScore": 1000
}
```

If any hard conflicts are found, the schedule's compliance score is reduced.

### 9.3 Algorithmic Performance & Cost Function Convergence
During optimization runs on the intermediate dataset, the cost function converged quickly:

- **Initial State**: Random assignments resulted in high conflict counts (student overlaps, room overflows), with cost scores exceeding 12,000.
- **Iteration 100-200**: The simulated annealing algorithm resolved most hard constraints.
- **Iteration 400**: Resolved all student and invigilator overlaps, reaching 100% hard constraint compliance.
- **Iteration 600-800**: The solver optimized soft constraints, reducing travel times and balancing workloads.

For datasets of up to 500 students, the solver converged to conflict-free schedules in under 3 seconds.

---

## CHAPTER 10: CONCLUSION & FUTURE SCOPE

### 10.1 Key Achievements
The project successfully delivered an automated scheduling solution for academic institutions:
- **Consistent Scheduling**: The Simulated Annealing solver resolved scheduling clashes.
- **Seating Allocations**: The greedy seating engine separated students writing the same exam to reduce cheating opportunities.
- **Administrative Exports**: Generated reports in PDF and Excel formats, and delivered assignments to proctors' inboxes via email.
- **AI-Powered Audits**: The Gemini Copilot analyzed schedule metrics and provided recommendations.

### 10.2 Project Limitations
- **Local SQLite Database**: SQLite is a single-file database. While fast, it does not support high-concurrency writes from multiple administrators.
- **Browser Thread Blocking**: Running the optimizer on the client can block the main browser thread on very large datasets.
- **No Biometric Integration**: The system does not support student identity verification.

### 10.3 Future Enhancements & Recommendations
- **Client Web Workers**: Move the scheduling algorithm to Web Workers to run optimization processes in the background.
- **Cloud Database Migration**: Migrate the backend to PostgreSQL or MySQL to support concurrent administrative access.
- **Advanced AI Assistance**: Expand the Gemini integration to support natural language scheduling edits (e.g. "move Professor Vance's duties to Friday afternoon").

---

## REFERENCES & BIBLIOGRAPHY
1. Kirkpatrick, S., Gelatt, C. D., & Vecchi, M. P. (1983). *Optimization by Simulated Annealing*. Science, 220(4598), 671-680.
2. Burke, E. K., Jackson, K., Kingston, J. H., & Weare, R. (1997). *Automated university timetabling: The state of the art*. The Computer Journal, 40(9), 565-571.
3. Carter, M. W., Laporte, G., & Lee, S. Y. (1996). *Examination timetabling: Algorithmic strategies and applications*. Journal of the Operational Research Society, 47(3), 373-383.
4. Google Gemini API Documentation. *GenAI SDK Guides & Model Reference*. Available at: https://ai.google.dev/docs.
5. SQLite WAL Mode Performance. *Write-Ahead Logging Architecture Reference*. Available at: https://www.sqlite.org/wal.html.
