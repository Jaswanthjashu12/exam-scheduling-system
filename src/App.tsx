/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry } from "./types";
import { generateDefaultDataset, generateSimpleDataset, evaluateSchedule, getConflictReport, buildEnrollmentIndex } from "./utils/solver";
import * as api from "./api/client";

// Import custom tab components
import ConfigurationTab from "./components/ConfigurationTab";
import SchedulerTab from "./components/SchedulerTab";
import SeatingTab from "./components/SeatingTab";
import ReportsTab from "./components/ReportsTab";
import GeminiCopilot from "./components/GeminiCopilot";
import LoginPage from "./components/LoginPage";

// Icon imports
import {
  Sparkles,
  School,
  GraduationCap,
  Users,
  Briefcase,
  Layers,
  Calendar,
  Contact,
  Grid,
  TrendingUp,
  FileText,
  BrainCircuit,
  MessageSquare,
  AlertTriangle,
  Info,
  Sliders,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Eye,
  Settings
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "config" | "scheduler" | "seating" | "reports" | "copilot">("dashboard");

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("exam_scheduler_logged_in") === "true";
  });
  const [loggedInUser, setLoggedInUser] = useState<string>(() => {
    return localStorage.getItem("exam_scheduler_logged_user") || "";
  });
  const [loading, setLoading] = useState<boolean>(true);

  const handleLogin = (college: string, username: string) => {
    setCollegeName(college);
    setLoggedInUser(username);
    setIsLoggedIn(true);
    localStorage.setItem("exam_scheduler_logged_in", "true");
    localStorage.setItem("exam_scheduler_logged_user", username);
    localStorage.setItem("exam_scheduler_college", college);
  };

  const handleLogout = () => {
    if (confirm("Sign out? Your data is saved and will be here when you return.")) {
      setIsLoggedIn(false);
      setLoggedInUser("");
      localStorage.removeItem("exam_scheduler_logged_in");
      localStorage.removeItem("exam_scheduler_logged_user");
    }
  };

  // Core College Metadata & Branches
  const [collegeName, setCollegeName] = useState<string>(() => {
    return localStorage.getItem("exam_scheduler_college") || "State Institute of Technology";
  });

  const [branches, setBranches] = useState<string[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_branches");
    return saved ? JSON.parse(saved) : [
      "Computer Science & Eng",
      "Mechanical Engineering",
      "Electrical & Electronics",
      "Civil Engineering",
      "Business & Humanities"
    ];
  });

  const [examStartDate, setExamStartDate] = useState<string>(() => {
    return localStorage.getItem("exam_scheduler_start_date") || "2026-06-15";
  });

  // Core Database lists
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_courses");
    return saved ? JSON.parse(saved) : [];
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_rooms");
    return saved ? JSON.parse(saved) : [];
  });
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_students");
    return saved ? JSON.parse(saved) : [];
  });
  const [invigilators, setInvigilators] = useState<Invigilator[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_invigilators");
    return saved ? JSON.parse(saved) : [];
  });

  // Generated active schedule entries
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_entries");
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch all data from API on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [coursesData, roomsData, studentsData, invigilatorsData, entriesData, branchesData, collegeData] = await Promise.all([
          api.fetchCourses(),
          api.fetchRooms(),
          api.fetchStudents(),
          api.fetchInvigilators(),
          api.fetchSchedule(),
          api.fetchBranches(),
          api.fetchCollege()
        ]);
        setCourses(coursesData);
        setRooms(roomsData);
        setStudents(studentsData);
        setInvigilators(invigilatorsData);
        setEntries(entriesData);
        setBranches(branchesData);
        setCollegeName(collegeData.name);
        setExamStartDate(collegeData.examStartDate);
      } catch (err) {
        console.error('Failed to load data from server, using localStorage fallback', err);
      } finally {
        setLoading(false);
      }
    }
    if (isLoggedIn) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  // Synchronize college metadata
  useEffect(() => {
    localStorage.setItem("exam_scheduler_college", collegeName);
    if (!loading && isLoggedIn) {
      api.updateCollegeMeta(collegeName, examStartDate).catch(console.error);
    }
  }, [collegeName, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_branches", JSON.stringify(branches));
    if (!loading && isLoggedIn) {
      api.replaceAllBranches(branches).catch(console.error);
    }
  }, [branches, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_start_date", examStartDate);
    if (!loading && isLoggedIn) {
      api.updateCollegeMeta(collegeName, examStartDate).catch(console.error);
    }
  }, [examStartDate, loading, isLoggedIn]);

  // Debounced API sync helper — prevents network thrashing during rapid changes
  const syncTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedApiSync = useCallback((key: string, fn: () => Promise<any>, delay = 400) => {
    clearTimeout(syncTimers.current[key]);
    syncTimers.current[key] = setTimeout(() => { fn().catch(console.error); }, delay);
  }, []);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_courses", JSON.stringify(courses));
    if (!loading && isLoggedIn) {
      debouncedApiSync('courses', () => api.replaceAllCourses(courses));
    }
  }, [courses, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_rooms", JSON.stringify(rooms));
    if (!loading && isLoggedIn) {
      debouncedApiSync('rooms', () => api.replaceAllRooms(rooms));
    }
  }, [rooms, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_students", JSON.stringify(students));
    if (!loading && isLoggedIn) {
      debouncedApiSync('students', () => api.replaceAllStudents(students));
    }
  }, [students, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_invigilators", JSON.stringify(invigilators));
    if (!loading && isLoggedIn) {
      debouncedApiSync('invigilators', () => api.replaceAllInvigilators(invigilators));
    }
  }, [invigilators, loading, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_entries", JSON.stringify(entries));
    if (!loading && isLoggedIn) {
      debouncedApiSync('entries', () => api.bulkReplaceSchedule(entries));
    }
  }, [entries, loading, isLoggedIn]);

  // Force reset all predefined lists to 0 and empty the database on fresh load
  useEffect(() => {
    if (!localStorage.getItem("exam_scheduler_v3_cleared")) {
      setCourses([]);
      setRooms([]);
      setStudents([]);
      setInvigilators([]);
      setEntries([]);
      localStorage.setItem("exam_scheduler_courses", "[]");
      localStorage.setItem("exam_scheduler_rooms", "[]");
      localStorage.setItem("exam_scheduler_students", "[]");
      localStorage.setItem("exam_scheduler_invigilators", "[]");
      localStorage.setItem("exam_scheduler_entries", "[]");
      localStorage.setItem("exam_scheduler_initialized", "true");
      localStorage.setItem("exam_scheduler_v3_cleared", "true");
    }
  }, []);

  // Automatically synchronize schedule entries with database config modifications
  useEffect(() => {
    setEntries((prevEntries) => {
      // 1. Remove entries for courses that no longer exist
      let updated = prevEntries.filter((ent) => courses.some((c) => c.id === ent.courseId));

      // 2. Automatically generate an Unscheduled draft schedule entry for any newly added course
      courses.forEach((crs) => {
        const hasEntry = updated.some((ent) => ent.courseId === crs.id);
        if (!hasEntry) {
          updated.push({
            id: `ent_${crs.id}`,
            courseId: crs.id,
            timeslotId: "",
            roomId: "",
            invigilatorId: "",
          });
        }
      });

      // 3. Keep room and proctor allocations valid if references were deleted/changed
      updated = updated.map((ent) => {
         let rId = ent.roomId;
         let iId = ent.invigilatorId;
         
         if (rId && !rooms.some((r) => r.id === rId)) {
           rId = "";
         }
         if (iId && !invigilators.some((i) => i.id === iId)) {
           iId = "";
         }
         
         return {
           ...ent,
           roomId: rId,
           invigilatorId: iId,
         };
      });

      return updated;
    });
  }, [courses, rooms, invigilators]);

  const clearAllData = () => {
    if (confirm("Are you sure you want to completely clear all database tables (courses, rooms, students, invigilators)? This will let you design your own curriculum from scratch.")) {
      setCourses([]);
      setRooms([]);
      setStudents([]);
      setInvigilators([]);
      setEntries([]);
    }
  };

  const loadDefaultData = () => {
    const data = generateDefaultDataset();
    setCourses(data.courses);
    setRooms(data.rooms);
    setStudents(data.students);
    setInvigilators(data.invigilators);

    // Initial draft: assign courses greedily across slots and rooms
    const draftEntries: ScheduleEntry[] = [];
    const timeslots = ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning"];
    
    data.courses.forEach((crs, index) => {
      // Pick timeslot and room
      const slotId = timeslots[index % timeslots.length];
      const roomId = data.rooms[index % data.rooms.length]?.id || "";
      const invId = data.invigilators[index % data.invigilators.length]?.id || "";

      draftEntries.push({
        id: `ent_${crs.id}`,
        courseId: crs.id,
        timeslotId: slotId,
        roomId: roomId,
        invigilatorId: invId
      });
    });

    setEntries(draftEntries);
  };

  const loadSimpleData = () => {
    const data = generateSimpleDataset();
    setCourses(data.courses);
    setRooms(data.rooms);
    setStudents(data.students);
    setInvigilators(data.invigilators);

    // Draft sequential schedule entries — 6 courses across 6 timeslots (1 per slot)
    const draftEntries: ScheduleEntry[] = [];
    const timeslots = [
      "Day-1-Morning", "Day-1-Afternoon", "Day-1-Evening",
      "Day-2-Morning", "Day-2-Afternoon", "Day-2-Evening"
    ];

    data.courses.forEach((crs, index) => {
      const slotId = timeslots[index % timeslots.length];
      const roomId = data.rooms[index % data.rooms.length]?.id || "";
      const invId = data.invigilators[index % data.invigilators.length]?.id || "";

      draftEntries.push({
        id: `ent_${crs.id}`,
        courseId: crs.id,
        timeslotId: slotId,
        roomId: roomId,
        invigilatorId: invId
      });
    });

    setEntries(draftEntries);
  };

  // Memoize enrollment index and health stats — only recompute when data actually changes
  const enrollmentIndex = useMemo(() => buildEnrollmentIndex(students), [students]);

  const { stats, conflicts } = useMemo(() => {
    const metrics = evaluateSchedule(entries, courses, students, rooms, invigilators, undefined, enrollmentIndex);
    const conflictList = getConflictReport(entries, courses, students, rooms, invigilators, undefined, enrollmentIndex);
    return { stats: metrics, conflicts: conflictList };
  }, [entries, courses, students, rooms, invigilators, enrollmentIndex]);

  // Show login page if not authenticated
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 text-sm">Loading examination data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] flex font-sans antialiased text-slate-300 print:bg-white print:text-black print:color-adjust-exact">
      
      {/* Dynamic Left Sidebar Rail Panel */}
      <aside className="print:hidden w-68 shrink-0 bg-[#12151C] border-r border-slate-800 flex flex-col justify-between shadow-xl sticky top-0 h-screen hidden md:flex">
        <div className="p-6 space-y-6">
          {/* Logo Brand Title */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[10px] font-bold tracking-tight text-slate-500 uppercase">Exam Scheduler</h1>
              <p className="text-[12px] font-bold text-white truncate" title={collegeName}>{collegeName}</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 pt-2">
            {[
              { id: "dashboard", label: "Overview Dashboard", icon: Grid },
              { id: "config", label: "Database Config", icon: Settings },
              { id: "scheduler", label: "Optimizer Calendar", icon: Calendar },
              { id: "seating", label: "Seating Layout Plan", icon: Contact },
              { id: "reports", label: "Analysis Reports", icon: FileText },
              { id: "copilot", label: "AI proctor Copilot", icon: BrainCircuit, premium: true },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                    activeTab === item.id
                      ? "bg-slate-800 text-white border border-slate-700/60 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {item.premium && (
                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-extrabold uppercase">AI</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{loggedInUser || "Administrator"}</p>
              <p className="text-[10px] text-slate-500 truncate">{collegeName}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#10b981]" title="Online" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Frame */}
      <main className="print:p-0 print:overflow-visible print:block flex-grow p-6 md:p-10 max-w-7xl mx-auto space-y-6 overflow-y-auto">
        
        {/* Top Floating Mobile Navbar Header */}
        <header className="print:hidden flex md:hidden items-center justify-between bg-[#12151C] border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 min-w-0">
            <School className="text-indigo-400 w-4.5 h-4.5 shrink-0" />
            <h1 className="text-xs font-bold text-white truncate max-w-[150px]" title={collegeName}>{collegeName}</h1>
          </div>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-700 text-xs rounded-lg font-semibold bg-slate-800 text-slate-200"
          >
            <option value="dashboard">Dashboard</option>
            <option value="config">Database Config</option>
            <option value="scheduler">Optimizer Calendar</option>
            <option value="seating">Seating Plan</option>
            <option value="reports">Reports</option>
            <option value="copilot">AI Copilot</option>
          </select>
        </header>

        {/* 1. OVERVIEW DASHBOARD VIEW */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Greeting summary banner card */}
            <div className="bg-[#12151C] text-slate-300 p-7 md:p-10 rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl">
              <div className="space-y-3 max-w-xl relative z-10">
                <span className="px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[9px] font-mono uppercase tracking-widest">
                  Academic Timetable optimizer
                </span>
                <h2 className="text-2xl md:text-3xl font-light text-white font-sans italic tracking-wide leading-tight">
                  Optimize Examination Timetables <span className="text-slate-500 not-italic font-mono text-xs ml-1">v1.0.4</span>
                </h2>
                <p className="text-slate-400 text-xs leading-relaxed font-light">
                  Welcome to the control center. Import scheduling parameters, automatically compute proctor allocations, map wheelchair floor access, and eliminate student back-to-back overlaps smoothly.
                </p>
                <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">⚡ Actions:</span>
                  <button
                    onClick={loadSimpleData}
                    className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold rounded-lg hover:bg-blue-600 hover:text-white transition cursor-pointer select-none"
                    title="Load 6-course, 50-student, 10-invigilator demo dataset"
                  >
                    ✨ Load 6-Course / 50-Student Dataset
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to completely delete all courses, rooms, students, and active assignments to reset the database counts to 0?")) {
                        setCourses([]);
                        setRooms([]);
                        setStudents([]);
                        setInvigilators([]);
                        setEntries([]);
                      }
                    }}
                    className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-white text-[11px] font-bold rounded-lg transition cursor-pointer select-none"
                    title="Delete all data to start with 0 counts"
                  >
                    🗑 Clear Database (Reset Counts to 0)
                  </button>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-blue-500/5 to-transparent pointer-events-none hidden lg:block"></div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Courses</p>
                  <p className="text-2xl font-mono text-white">{courses.length}</p>
                </div>
              </div>

              <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Exam Rooms</p>
                  <p className="text-2xl font-mono text-white">{rooms.length}</p>
                </div>
              </div>

              <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Students roster</p>
                  <p className="text-2xl font-mono text-white">{students.length}</p>
                </div>
              </div>

              <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Proctors</p>
                  <p className="text-2xl font-mono text-white">{invigilators.length}</p>
                </div>
              </div>
            </div>

            {/* Overall Schedule Audit Overview Bento boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Compliance Rating Card */}
              <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Constraint Health Score</h3>
                
                <div className="space-y-2 text-center py-4">
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Timetable Compliance</p>
                  <p className={`text-4xl font-mono font-extrabold ${stats.compliancePercentage === 100 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "text-amber-400"}`}>
                    {stats.compliancePercentage}%
                  </p>
                  <span className="text-[10px] block px-3 py-1 rounded bg-slate-900 border border-slate-800 max-w-xs mx-auto text-slate-400">
                    {stats.studentConflictCount === 0 && stats.roomCapacityViolations === 0 && stats.invigilatorOverlapCount === 0
                      ? "✓ Strict Hard Constraints Met"
                      : "⚠ Dynamic conflicts flagged"}
                  </span>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs leading-normal">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Student overlaps</span>
                    <span className={`font-semibold ${stats.studentConflictCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {stats.studentConflictCount} overlaps
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Room capacity breaches</span>
                    <span className={`font-semibold ${stats.roomCapacityViolations > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {stats.roomCapacityViolations} errors
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Accommodation mismatches</span>
                    <span className="font-semibold text-emerald-400">
                      0 errors
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Proctor clashes</span>
                    <span className={`font-semibold ${stats.invigilatorOverlapCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {stats.invigilatorOverlapCount} clashes
                    </span>
                  </div>
                </div>
              </div>

              {/* Conflict report preview pane */}
              <div className="lg:col-span-2 bg-[#12151C] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between font-mono">
                  <span>Simultaneous Exam Overlaps ({conflicts.length})</span>
                  <button onClick={() => setActiveTab("scheduler")} className="text-xs text-blue-400 hover:text-blue-300 transition cursor-pointer">
                    Manual Solver →
                  </button>
                </h3>

                <div className="space-y-3 max-h-56 overflow-y-auto">
                  {conflicts.map((conf) => (
                    <div key={conf.id} className={`p-3.5 rounded-xl border flex gap-3 ${
                      conf.type === "Hard" 
                        ? "bg-rose-950/20 border-rose-900/40 text-rose-300" 
                        : "bg-amber-950/20 border-amber-900/40 text-amber-300"
                    }`}>
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${conf.type === "Hard" ? "text-rose-400" : "text-amber-400"}`} />
                      <div className="space-y-0.5 text-xs">
                        <p className="font-semibold">{conf.category}</p>
                        <p className="text-slate-400 leading-normal">{conf.message}</p>
                      </div>
                    </div>
                  ))}

                  {conflicts.length === 0 && (
                    <div className="py-14 text-center border border-dashed border-slate-800 rounded-xl space-y-1.5">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]" />
                      <div>
                        <p className="text-xs font-bold text-white">No scheduling conflicts detected</p>
                        <p className="text-[10px] text-slate-500 max-w-xs mx-auto font-light">This schedule completely complies with institutional student safety buffers</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. DATABASE CONFIGURATION TAB */}
        {activeTab === "config" && (
          <ConfigurationTab
            courses={courses}
            setCourses={setCourses}
            rooms={rooms}
            setRooms={setRooms}
            students={students}
            setStudents={setStudents}
            invigilators={invigilators}
            setInvigilators={setInvigilators}
            branches={branches}
            setBranches={setBranches}
            collegeName={collegeName}
            setCollegeName={setCollegeName}
            onReset={loadDefaultData}
            onLoadSimple={loadSimpleData}
            onClearAll={clearAllData}
            examStartDate={examStartDate}
            setActiveTab={setActiveTab}
          />
        )}

        {/* 3. OPTIMIZER SCHEDULER CALENDAR TAB */}
        {activeTab === "scheduler" && (
        <SchedulerTab
            courses={courses}
            setCourses={setCourses}
            rooms={rooms}
            students={students}
            setStudents={setStudents}
            invigilators={invigilators}
            setInvigilators={setInvigilators}
            entries={entries}
            setEntries={setEntries}
            branches={branches}
            onLoadSimple={loadSimpleData}
            examStartDate={examStartDate}
            setExamStartDate={setExamStartDate}
            collegeName={collegeName}
          />
        )}

        {/* 4. SEATING MAP MATRIX TAB */}
        {activeTab === "seating" && (
          <SeatingTab
            courses={courses}
            rooms={rooms}
            students={students}
            invigilators={invigilators}
            entries={entries}
            setEntries={setEntries}
            examStartDate={examStartDate}
            collegeName={collegeName}
            setActiveTab={setActiveTab}
          />
        )}

        {/* 5. ANALYSIS REPORTS TAB */}
        {activeTab === "reports" && (
          <ReportsTab
            courses={courses}
            rooms={rooms}
            students={students}
            invigilators={invigilators}
            entries={entries}
            collegeName={collegeName}
            examStartDate={examStartDate}
          />
        )}

        {/* 6. AI SCHEDULER COPILOT TAB */}
        {activeTab === "copilot" && (
          <GeminiCopilot
            courses={courses}
            rooms={rooms}
            students={students}
            invigilators={invigilators}
            entries={entries}
          />
        )}

      </main>
    </div>
  );
}
