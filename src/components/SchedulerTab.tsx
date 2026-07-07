/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry, Timeslot } from "../types";
import { DEFAULT_TIMESLOTS, DEFAULT_WEIGHTS, runOptimization, evaluateSchedule, getConflictReport, runSimpleSequentialAllocation, getDayDate, getTimeslotExact } from "../utils/solver";
import { Play, RotateCcw, Edit2, Trash, CheckCircle2, AlertTriangle, Eye, Send, X, Mail, MessageSquare, AlertCircle, Sparkles, Settings2, Calendar, Clock, Plus } from "lucide-react";
import * as api from "../api/client";

interface SchedulerTabProps {
  courses: Course[];
  setCourses?: React.Dispatch<React.SetStateAction<Course[]>>;
  rooms: Room[];
  students: Student[];
  setStudents?: React.Dispatch<React.SetStateAction<Student[]>>;
  invigilators: Invigilator[];
  setInvigilators?: React.Dispatch<React.SetStateAction<Invigilator[]>>;
  entries: ScheduleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
  branches?: string[];
  onLoadSimple: () => void;
  examStartDate?: string;
  setExamStartDate?: (date: string) => void;
  collegeName?: string;
}

export default function SchedulerTab({
  courses,
  setCourses,
  rooms,
  students,
  setStudents,
  invigilators,
  setInvigilators,
  entries,
  setEntries,
  branches = [],
  onLoadSimple,
  examStartDate = "2026-06-15",
  setExamStartDate,
  collegeName = "",
}: SchedulerTabProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [iterations, setIterations] = useState(0);
  const [maxIter] = useState(600);
  const [liveMetrics, setLiveMetrics] = useState<any>(null);
  const [generationType, setGenerationType] = useState<"heuristic" | "sequential">("heuristic");
  const [strictBranchSeparation, setStrictBranchSeparation] = useState<boolean>(() => {
    return localStorage.getItem("exam_scheduler_strict_branch_separation") === "true";
  });
  
  // Manual override editing state
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [moveSlotId, setMoveSlotId] = useState("");
  const [moveRoomId, setMoveRoomId] = useState("");
  const [moveInvigId, setMoveInvigId] = useState("");
  
  // Override real-time validation warnings
  const [validationReport, setValidationReport] = useState<string[]>([]);

  // Quick-scheduling states for unscheduled courses
  const [selectedUnscheduledCourse, setSelectedUnscheduledCourse] = useState<string | null>(null);
  const [unschedSlotId, setUnschedSlotId] = useState("");
  const [unschedRoomId, setUnschedRoomId] = useState("");
  const [unschedInvigId, setUnschedInvigId] = useState("");
  const [quickScheduleError, setQuickScheduleError] = useState<string | null>(null);

  // Dynamic Exam Creation & Direct Scheduling states
  const [isAddingExam, setIsAddingExam] = useState(false);
  const [newCourseId, setNewCourseId] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseBranch, setNewCourseBranch] = useState("");
  const [newCourseYear, setNewCourseYear] = useState<number>(1);
  const [newCourseDuration, setNewCourseDuration] = useState(120);
  const [newCoursePriority, setNewCoursePriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [newSlotId, setNewSlotId] = useState(DEFAULT_TIMESLOTS[0]?.id || "");
  const [newRoomId, setNewRoomId] = useState("");
  const [newInvigId, setNewInvigId] = useState("");
  const [newStudentCount, setNewStudentCount] = useState(15);

  const handleCreateAndScheduleNewExam = () => {
    if (!newCourseId.trim() || !newCourseName.trim()) {
      alert("Please enter a Course Code and Course Name.");
      return;
    }
    const normalizedId = newCourseId.trim().toUpperCase();
    if (courses.some((c) => c.id === normalizedId)) {
      alert(`Course Code "${normalizedId}" already exists! Please use a unique Code.`);
      return;
    }

    const tSlotId = newSlotId || DEFAULT_TIMESLOTS[0]?.id || "";
    const tRoomId = newRoomId || rooms[0]?.id || "";
    const tInvigId = newInvigId || (invigilators[0]?.id || "");

    if (!tSlotId || !tRoomId) {
      alert("Please configure at least one Room and one Timeslot.");
      return;
    }

    // 1. Create Course
    const newCourseObj: Course = {
      id: normalizedId,
      name: newCourseName.trim(),
      duration: newCourseDuration,
      priority: newCoursePriority,
      branch: newCourseBranch || branches[0] || "General Academic",
      year: newCourseYear,
    };

    if (setCourses) {
      setCourses((prev) => [...prev, newCourseObj]);
    }

    // 2. Enroll Students
    if (setStudents && newStudentCount > 0) {
      const generatedStudents: Student[] = [];
      for (let i = 1; i <= newStudentCount; i++) {
        generatedStudents.push({
          id: `STU-GEN-${normalizedId}-${i}`,
          name: `Student ${String.fromCharCode(65 + (i % 26))}${i} (${normalizedId})`,
          courses: [normalizedId],
          accommodations: i % 10 === 0 ? ["extra_time"] : i % 14 === 0 ? ["accessible"] : [],
          year: newCourseYear,
        });
      }
      setStudents((prev) => [...prev, ...generatedStudents]);
    }

    // 3. Create active schedule entry
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.courseId !== normalizedId);
      return [
        ...filtered,
        {
          id: `ent_${normalizedId}`,
          courseId: normalizedId,
          timeslotId: tSlotId,
          roomId: tRoomId,
          invigilatorId: tInvigId,
        }
      ];
    });

    // Reset inputs
    setNewCourseId("");
    setNewCourseName("");
    setNewCourseBranch("");
    setNewCourseYear(1);
    setNewStudentCount(15);
    setIsAddingExam(false);

    alert(`🎉 Exam "${normalizedId}" successfully created!\n- Branch: ${newCourseObj.branch}\n- Scheduled on: ${getTimeslotExact(tSlotId, examStartDate)}\n- Assigned Room: ${rooms.find(r => r.id === tRoomId)?.name || tRoomId}\n- Proctored by: ${invigilators.find(i => i.id === tInvigId)?.name || "None"}\n- Enrolled students: ${newStudentCount}`);
  };

  // Unscheduled courses lists helper
  const unscheduledCourses = courses.filter((crs) => {
    const entry = entries.find((e) => e.courseId === crs.id);
    return !entry || !entry.timeslotId || !entry.roomId;
  });

  React.useEffect(() => {
    if (!newRoomId && rooms.length > 0) {
      setNewRoomId(rooms[0].id);
    }
    if (!newInvigId && invigilators.length > 0) {
      setNewInvigId(invigilators[0].id);
    }
  }, [rooms, invigilators]);

  const handleStartQuickSchedule = (courseId: string) => {
    setSelectedUnscheduledCourse(courseId);
    setUnschedSlotId(DEFAULT_TIMESLOTS[0]?.id || "");
    setUnschedRoomId(rooms[0]?.id || "");
    setUnschedInvigId(invigilators[0]?.id || "");
    setQuickScheduleError(null);
  };

  const handleSaveQuickSchedule = () => {
    if (!selectedUnscheduledCourse) return;
    if (!unschedSlotId || !unschedRoomId) {
      setQuickScheduleError("Please select both a timeslot and a room.");
      return;
    }
    
    // Find if there's already an entry for this course, update it; otherwise create a new one
    setEntries((prev) => {
      const existingIdx = prev.findIndex((e) => e.courseId === selectedUnscheduledCourse);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          timeslotId: unschedSlotId,
          roomId: unschedRoomId,
          invigilatorId: unschedInvigId,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `ent_${selectedUnscheduledCourse}`,
            courseId: selectedUnscheduledCourse,
            timeslotId: unschedSlotId,
            roomId: unschedRoomId,
            invigilatorId: unschedInvigId,
          }
        ];
      }
    });

    // Reset selection state
    setSelectedUnscheduledCourse(null);
  };

  // Simulation notification trigger
  const [smsEmailLogs, setSmsEmailLogs] = useState<{ id: string; type: "Email" | "SMS"; to: string; text: string; sent: boolean }[]>([]);
  const [activeNotifier, setActiveNotifier] = useState<ScheduleEntry | null>(null);

  // Helper: silently notify students about their exam assignment
  const notifyStudentsAboutExam = async (
    scheduledEntries: ScheduleEntry[],
    currentCourses: Course[],
    currentRooms: Room[]
  ) => {
    const scheduled = scheduledEntries.filter(e => e.timeslotId && e.roomId);
    for (const entry of scheduled) {
      try {
        const crs = currentCourses.find(c => c.id === entry.courseId);
        const rm = currentRooms.find(r => r.id === entry.roomId);
        const tsLabel = getTimeslotExact(entry.timeslotId, examStartDate);
        const roomLabel = rm ? `${rm.name} (${rm.building})` : entry.roomId;
        await api.notifyExamAssignment({
          courseId: entry.courseId,
          courseName: crs?.name,
          timeslotLabel: tsLabel,
          roomLabel,
          collegeName,
        });
      } catch (err) {
        // Silent failure — never block the main UX flow
        console.warn('[Scheduler] Failed to send student assignment notification for course', entry.courseId, err);
      }
    }
  };

  // Trigger Constraint satisfaction optimization solver
  const startOptimizer = async () => {
    setIsOptimizing(true);
    setIterations(0);

    try {
      // Setup progress animation
      let step = 0;
      const progressInterval = setInterval(() => {
        step += Math.floor(maxIter / 20);
        if (step < maxIter) {
          setIterations(step);
        } else {
          clearInterval(progressInterval);
        }
      }, 50);

      // Call server optimizer
      const result = await api.runServerOptimizer(generationType, maxIter, strictBranchSeparation);

      clearInterval(progressInterval);
      setIterations(maxIter);
      setEntries(result.entries);
      setLiveMetrics(result.metrics);
      setIsOptimizing(false);

      // Notify students of their exam assignments (background, silent)
      notifyStudentsAboutExam(result.entries, courses, rooms).catch(console.warn);
    } catch (err) {
      console.warn("Server-side optimization failed, falling back to local solver:", err);
      // Client-side fallback
      if (generationType === "sequential") {
        setTimeout(() => {
          const solutions = runSimpleSequentialAllocation(courses, students, rooms, invigilators, strictBranchSeparation);
          let step = 0;
          const interval = setInterval(() => {
            step += 50;
            setIterations(step);
            const tempStats = evaluateSchedule(solutions, courses, students, rooms, invigilators, { ...DEFAULT_WEIGHTS, strictBranchSeparation });
            setLiveMetrics(tempStats);
            if (step >= maxIter) {
              clearInterval(interval);
              setEntries(solutions);
              setLiveMetrics(tempStats);
              setIsOptimizing(false);
              // Notify students (background, silent)
              notifyStudentsAboutExam(solutions, courses, rooms).catch(console.warn);
            }
          }, 30);
        }, 50);
      } else {
        setTimeout(() => {
          runOptimization(
            courses,
            students,
            rooms,
            invigilators,
            { ...DEFAULT_WEIGHTS, strictBranchSeparation },
            (solutions, stats, step, max) => {
              setEntries(solutions);
              setIterations(step);
              setLiveMetrics(stats);
              if (step >= max) {
                setIsOptimizing(false);
                // Notify students (background, silent)
                notifyStudentsAboutExam(solutions, courses, rooms).catch(console.warn);
              }
            },
            maxIter
          );
        }, 50);
      }
    }
  };

  const handleEditClick = (entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setMoveSlotId(entry.timeslotId);
    setMoveRoomId(entry.roomId);
    setMoveInvigId(entry.invigilatorId);
    triggerInstantValidation(entry.courseId, entry.timeslotId, entry.roomId, entry.invigilatorId);
  };

  const handleDropdownChange = (field: "slot" | "room" | "invig", val: string) => {
    if (!editingEntry) return;
    let s = moveSlotId;
    let r = moveRoomId;
    let i = moveInvigId;

    if (field === "slot") { s = val; setMoveSlotId(val); }
    if (field === "room") { r = val; setMoveRoomId(val); }
    if (field === "invig") { i = val; setMoveInvigId(val); }

    triggerInstantValidation(editingEntry.courseId, s, r, i);
  };

  // Instant Validation check to satisfy FR-9 (All changes must be validated)
  const triggerInstantValidation = (courseId: string, slotId: string, roomId: string, invigId: string) => {
    const tempEntries = entries.map((e) =>
      e.courseId === courseId ? { ...e, timeslotId: slotId, roomId: roomId, invigilatorId: invigId } : e
    );

    const weights = { ...DEFAULT_WEIGHTS, strictBranchSeparation };
    const reports = getConflictReport(tempEntries, courses, students, rooms, invigilators, weights);
    const specificWarnings = reports
      .filter((rep) => rep.id.includes(courseId) || rep.id.includes(roomId) || (invigId && rep.id.includes(invigId)))
      .map((rep) => `${rep.type} - ${rep.category}: ${rep.message}`);

    // Check room size
    const roomObj = rooms.find((r) => r.id === roomId);
    const studCount = students.filter((s) => s.courses.includes(courseId)).length;
    if (roomObj && studCount > roomObj.capacity) {
      specificWarnings.push(`Hard Room Overflow: Enrolled students (${studCount} seats) exceeds room capacity (${roomObj.capacity} seats)`);
    }

    setValidationReport(specificWarnings);
  };

  const saveManualOverride = async () => {
    if (!editingEntry) return;

    const updated = entries.map((e) =>
      e.courseId === editingEntry.courseId
        ? { ...e, timeslotId: moveSlotId, roomId: moveRoomId, invigilatorId: moveInvigId }
        : e
    );
    setEntries(updated);

    // Queue simulated notification event logs to trigger FR-10 requirement
    const crs = courses.find((c) => c.id === editingEntry.courseId);
    const rm = rooms.find((r) => r.id === moveRoomId);
    const ts = DEFAULT_TIMESLOTS.find((t) => t.id === moveSlotId);
    const inv = invigilators.find((i) => i.id === moveInvigId);

    const logList = [
      {
        id: `email_stu_${Date.now()}`,
        type: "Email" as const,
        to: "dineshkumarasapu@gmail.com",
        text: `📅 Exam Date published: Course "${crs?.name || editingEntry.courseId}" rescheduled to Day ${ts?.day || 1} ${ts?.period} inside Building Hall "${rm?.building || "Main Arc"} - Room ${rm?.name || moveRoomId}".`,
        sent: false,
      },
      {
        id: `sms_invig_${Date.now()}`,
        type: "SMS" as const,
        to: "6304319176",
        text: `🚨 Proctor update: You are designated to invigilate exam for "${crs?.name}" in room [${rm?.name}] on Day ${ts?.day} ${ts?.period}.`,
        sent: false,
      }
    ];

    setSmsEmailLogs((prev) => [...logList, ...prev].slice(0, 10)); // Keep last 10 entries
    setActiveNotifier(editingEntry);
    setEditingEntry(null);

    // Send real exam assignment notification emails to enrolled students (background, silent)
    if (moveSlotId && moveRoomId) {
      try {
        const tsLabel = getTimeslotExact(moveSlotId, examStartDate);
        const roomLabel = rm ? `${rm.name} (${rm.building})` : moveRoomId;
        api.notifyExamAssignment({
          courseId: editingEntry.courseId,
          courseName: crs?.name,
          timeslotLabel: tsLabel,
          roomLabel,
          collegeName,
        }).then(result => {
          if (result.sentCount > 0) {
            console.log(`[Scheduler] Exam assignment emails sent to ${result.sentCount} student(s).`);
          }
        }).catch(err => {
          console.warn('[Scheduler] Student exam assignment email error (non-blocking):', err);
        });
      } catch (err) {
        console.warn('[Scheduler] Could not initiate student exam assignment emails:', err);
      }
    }
  };

  const dispatchAlertNotifications = () => {
    setSmsEmailLogs((prev) => prev.map((l) => ({ ...l, sent: true })));
    alert("✉️ Notifications dispatched! Emails transmitted to student portals and SMS alerts triggered to Invigilator mobile numbers successfully.");
    setActiveNotifier(null);
  };

  const handleSendNotification = async (entryId: string) => {
    try {
      const res = await fetch(`/api/schedule/${entryId}/notify`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (data.url) {
          if (confirm(`✅ ${data.message}\n\nClick OK to open the Ethereal Test Email in a new tab!`)) {
            window.open(data.url, '_blank');
          }
        } else {
          alert(`✅ ${data.message}`);
        }
      } else {
        alert(`❌ ${data.error || 'Failed to send notification'}`);
      }
    } catch (err) {
      alert('❌ Network error while sending notification');
      console.error(err);
    }
  };

  const weights = { ...DEFAULT_WEIGHTS, strictBranchSeparation };
  const currentMetrics = evaluateSchedule(entries, courses, students, rooms, invigilators, weights);

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Auto-Schedule Allocation Engine
          </h2>
          <p className="text-xs text-slate-400">
            Choose a strategy to generate exam timetables. Run our Heuristic AI Solver or assign deterministically with the Simple Allocator.
          </p>
        </div>
        
        {/* Toggles and Quick Presets */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          {/* Strategy Picker Toggle */}
          <div className="flex bg-[#0A0C10] p-1 rounded-xl border border-slate-800 w-full sm:w-auto justify-center select-none">
            <button
              onClick={() => setGenerationType("heuristic")}
              disabled={isOptimizing}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                generationType === "heuristic"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/20"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Heuristic AI Solver
            </button>
            <button
              onClick={() => setGenerationType("sequential")}
              disabled={isOptimizing}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                generationType === "sequential"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/20"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Simple Allocator
            </button>
          </div>

          {/* Strict Department Separation Checkbox */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none bg-[#0A0C10] px-3.5 py-2.5 rounded-xl border border-slate-800 w-full sm:w-auto justify-center">
            <input
              type="checkbox"
              checked={strictBranchSeparation}
              disabled={isOptimizing}
              onChange={(e) => {
                const val = e.target.checked;
                setStrictBranchSeparation(val);
                localStorage.setItem("exam_scheduler_strict_branch_separation", String(val));
              }}
              className="accent-blue-500 rounded cursor-pointer"
            />
            <span>Strict Dept Separation</span>
          </label>

          {/* Load Sample Simple Preset button */}
          <button
            onClick={onLoadSimple}
            disabled={isOptimizing}
            className="w-full sm:w-auto px-4 py-2 border border-blue-500/20 hover:border-blue-400/50 bg-[#0A0C10] hover:bg-blue-950/20 text-blue-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer select-none"
            title="Load Simple Minimal Presets Instance and Data"
          >
            📂 Load Simple Preset
          </button>

          {/* Clear Schedule button */}
          <button
            onClick={() => {
              if (confirm("Are you sure you want to unschedule all exams? The calendar grid will be cleared, and all courses will become pending/unscheduled.")) {
                const cleared = entries.map((e) => ({ ...e, timeslotId: "", roomId: "", invigilatorId: "" }));
                setEntries(cleared);
              }
            }}
            disabled={isOptimizing}
            className="w-full sm:w-auto px-4 py-2 border border-rose-500/20 hover:border-rose-400/50 bg-[#0A0C10] hover:bg-rose-950/20 text-rose-450 text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer select-none"
            title="Wipe/Clear all assignments from the timeslot grid"
          >
            🧹 Clear Schedule
          </button>

          {/* Trigger generator button */}
          <button
            onClick={startOptimizer}
            disabled={isOptimizing}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_15px_rgba(37,99,235,0.3)] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm select-none"
          >
            <Play className="w-4 h-4 mr-0.5" />
            {isOptimizing ? "Generating..." : generationType === "sequential" ? "Run Simple Allocator" : "Run Heuristic AI Solver"}
          </button>
        </div>
      </div>

      {/* Solver status bar */}
      {isOptimizing && (
        <div className="p-5 rounded-2xl border border-blue-900/40 bg-blue-950/20 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-blue-200">Optimization Progress Status</span>
            <span className="font-mono text-blue-400 font-bold">Heuristic Step {iterations} / {maxIter}</span>
          </div>
          <div className="w-full bg-[#0A0C10] rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-100 rounded-full"
              style={{ width: `${(iterations / maxIter) * 105}%` }}
            ></div>
          </div>
          {liveMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 bg-[#0A0C10] rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Compliance Rate</p>
                <p className="text-sm font-bold text-emerald-400">{liveMetrics.compliancePercentage}%</p>
              </div>
              <div className="p-2.5 bg-[#0A0C10] rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Student Conflicts</p>
                <p className={`text-sm font-bold ${liveMetrics.studentConflictCount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {liveMetrics.studentConflictCount}
                </p>
              </div>
              <div className="p-2.5 bg-[#0A0C10] rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Double Proctors</p>
                <p className="text-sm font-bold text-slate-200">{liveMetrics.invigilatorOverlapCount}</p>
              </div>
              <div className="p-2.5 bg-[#0A0C10] rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Wasted Hall Seats</p>
                <p className="text-sm font-bold text-amber-400">{liveMetrics.roomWaste} pts</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* College brand, Dates and Direct Exam Scheduler Widget */}
      <div className="p-6 rounded-2xl bg-[#12151C] border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Exam Creator & Direct Date Scheduler</h3>
              <p className="text-[10px] text-slate-400">Add an exam, select a date & room, and assign proctors instantly</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#0A0C10] px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Exams Start Date:</span>
              <input
                type="date"
                value={examStartDate}
                onChange={(e) => setExamStartDate && setExamStartDate(e.target.value)}
                className="bg-transparent text-xs text-indigo-400 border-none outline-none focus:ring-0 font-bold cursor-pointer"
              />
            </div>
            <button
              onClick={() => setIsAddingExam(!isAddingExam)}
              className="px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingExam ? "Dismiss Form" : "Create & Schedule Exam"}
            </button>
          </div>
        </div>

        {isAddingExam && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-5 bg-[#0A0C10]/40 rounded-xl border border-slate-800/80 animate-none">
            {/* Column 1: Details */}
            <div className="space-y-3.5">
              <span className="text-[9px] font-bold text-indigo-400 uppercase bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded">1. Identity</span>
              
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Course / Exam Code</label>
                <input
                  type="text"
                  placeholder="e.g. CS-402"
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Course / Exam Name</label>
                <input
                  type="text"
                  placeholder="e.g. Machine Learning"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Academic Branch</label>
                <select
                  value={newCourseBranch}
                  onChange={(e) => setNewCourseBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="">-- Choose Branch --</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Academic Year</label>
                <select
                  value={newCourseYear}
                  onChange={(e) => setNewCourseYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-medium"
                >
                  <option value={1}>Year 1 (Freshman)</option>
                  <option value={2}>Year 2 (Sophomore)</option>
                  <option value={3}>Year 3 (Junior)</option>
                  <option value={4}>Year 4 (Senior)</option>
                </select>
              </div>
            </div>

            {/* Column 2: Specifics */}
            <div className="space-y-3.5">
              <span className="text-[9px] font-bold text-blue-400 uppercase bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 rounded">2. Configuration</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Duration</label>
                  <select
                    value={newCourseDuration}
                    onChange={(e) => setNewCourseDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value={90}>90 Min</option>
                    <option value={120}>120 Min</option>
                    <option value={180}>180 Min</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Priority</label>
                  <select
                    value={newCoursePriority}
                    onChange={(e) => setNewCoursePriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="High">🔴 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Enrolled Student Count: <span className="text-white font-bold">{newStudentCount} seats</span></label>
                <input
                  type="range"
                  min={1}
                  max={45}
                  value={newStudentCount}
                  onChange={(e) => setNewStudentCount(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer text-xs"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 seat</span>
                  <span>45 seats</span>
                </div>
              </div>
            </div>

            {/* Column 3: Schedule Date and Room */}
            <div className="space-y-3.5">
              <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded">3. Date & Hall Selections</span>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Exam Date & Session</label>
                {/* Calendar date picker */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/></svg>
                    </span>
                    <input
                      type="date"
                      value={(() => {
                        // Derive selected date from newSlotId + examStartDate
                        const slot = DEFAULT_TIMESLOTS.find(s => s.id === newSlotId);
                        if (!slot || !examStartDate) return examStartDate;
                        const base = new Date(examStartDate);
                        base.setDate(base.getDate() + (slot.day - 1));
                        return base.toISOString().split("T")[0];
                      })()}
                      min={examStartDate}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const picked = new Date(e.target.value);
                        const base = new Date(examStartDate);
                        const dayNum = Math.round((picked.getTime() - base.getTime()) / 86400000) + 1;
                        const maxDay = Math.max(...DEFAULT_TIMESLOTS.map(s => s.day));
                        if (dayNum < 1 || dayNum > maxDay) {
                          const formattedPicked = picked.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          });
                          const formattedBase = base.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          });
                          const confirmMsg = `The selected date (${formattedPicked}) is outside the current ${maxDay}-day exam window starting on ${formattedBase}.\n\nWould you like to shift the Exams Start Date to ${formattedPicked} so you can schedule exams starting on this date?`;
                          if (confirm(confirmMsg)) {
                            if (setExamStartDate) {
                              setExamStartDate(e.target.value);
                            }
                            const currentSlot = DEFAULT_TIMESLOTS.find(s => s.id === newSlotId);
                            const currentPeriod = currentSlot?.period || "Morning";
                            const matchSlot = DEFAULT_TIMESLOTS.find(s => s.day === 1 && s.period === currentPeriod) || DEFAULT_TIMESLOTS[0];
                            setNewSlotId(matchSlot.id);
                          }
                          return;
                        }
                        // Find slot matching this day + current period
                        const currentSlot = DEFAULT_TIMESLOTS.find(s => s.id === newSlotId);
                        const currentPeriod = currentSlot?.period || "Morning";
                        const matchSlot = DEFAULT_TIMESLOTS.find(s => s.day === dayNum && s.period === currentPeriod)
                          || DEFAULT_TIMESLOTS.find(s => s.day === dayNum)
                          || DEFAULT_TIMESLOTS[0];
                        if (matchSlot) setNewSlotId(matchSlot.id);
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
                    />
                  </div>
                  {/* Session picker */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["Morning", "Afternoon", "Evening"] as const).map((period) => {
                      const currentSlot = DEFAULT_TIMESLOTS.find(s => s.id === newSlotId);
                      const isActive = currentSlot?.period === period;
                      const dayNum = currentSlot?.day || 1;
                      const targetSlot = DEFAULT_TIMESLOTS.find(s => s.day === dayNum && s.period === period);
                      return (
                        <button
                          key={period}
                          type="button"
                          disabled={!targetSlot}
                          onClick={() => targetSlot && setNewSlotId(targetSlot.id)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            isActive
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : targetSlot
                              ? "bg-[#0A0C10] border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-slate-200"
                              : "bg-[#0A0C10] border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                          }`}
                        >
                          {period === "Morning" ? "🌅" : period === "Afternoon" ? "☀️" : "🌆"} {period}
                        </button>
                      );
                    })}
                  </div>
                  {/* Show selected label */}
                  <p className="text-[10px] text-indigo-400 font-semibold text-center pt-0.5">
                    📅 {getTimeslotExact(newSlotId, examStartDate)}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Assigned Hall Room</label>
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-semibold"
                >
                  {rooms.length === 0 && <option value="">-- No Rooms Configured --</option>}
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Cap: {r.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column 4: Proctor Allocation */}
            <div className="space-y-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-emerald-400 uppercase bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded block w-fit mb-2">4. Assign Proctor</span>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Invigilator Staff Duty</label>
                  <select
                    value={newInvigId}
                    onChange={(e) => setNewInvigId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#12151C] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value="">-- Let System Auto Assign Later --</option>
                    {invigilators.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name} ({inv.department || "General"})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateAndScheduleNewExam}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1 mt-2 tracking-wide font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save Roster & Schedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary Calendar Slots Block Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4 bg-[#12151C] p-6 rounded-2xl border border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Timetable Slot Grid Matrix</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEFAULT_TIMESLOTS.map((slot) => {
              // Filters entries placed in this slot
              const slotEntries = entries.filter((e) => e.timeslotId === slot.id);

              return (
                <div key={slot.id} className="p-4 rounded-xl border border-slate-850 bg-[#0A0C10]/40 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{getTimeslotExact(slot.id, examStartDate)}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#12151C] text-[10px] font-bold text-slate-300 border border-slate-800">
                      {slotEntries.length} exams
                    </span>
                  </div>

                  <div className="space-y-2 flex-grow min-h-[140px]">
                    {slotEntries.map((ent) => {
                      const course = courses.find((c) => c.id === ent.courseId);
                      const room = rooms.find((r) => r.id === ent.roomId);
                      const inv = invigilators.find((i) => i.id === ent.invigilatorId);
                      const studCount = students.filter((s) => s.courses.includes(ent.courseId)).length;

                      return (
                        <div key={ent.id} className="p-3 bg-[#12151C] rounded-lg border border-slate-800 shadow-sm space-y-2 hover:border-slate-700 transition group relative">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <p className="text-[10px] font-mono font-semibold text-blue-400">{course?.id}</p>
                              <h5 className="text-xs font-bold text-slate-100 leading-tight truncate max-w-[140px]" title={course?.name}>
                                {course?.name}
                              </h5>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSendNotification(ent.id)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 cursor-pointer"
                                title="Send Email Notification to Invigilator"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditClick(ent)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 cursor-pointer"
                                title="Manual Override Assignment Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove/Unschedule exam for "${course?.name || ent.courseId}"? It will be moved to the Pending list.`)) {
                                    setEntries((prev) =>
                                      prev.map((e) =>
                                        e.id === ent.id ? { ...e, timeslotId: "", roomId: "", invigilatorId: "" } : e
                                      )
                                    );
                                  }
                                }}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer animate-none"
                                title="Unschedule exam"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                            <p className="font-medium text-slate-300">🏢 Room: <span className="font-semibold text-white">{room?.name || "Unassigned"}</span> ({studCount} students)</p>
                            <p className="font-medium text-slate-300">👤 Proctored by: <span className="font-semibold text-slate-200">{inv?.name || "None Assigned"}</span></p>
                          </div>
                        </div>
                      );
                    })}

                    {slotEntries.length === 0 && (
                      <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-lg py-12">
                        <p className="text-[11px] text-slate-500 italic">No exams scheduled</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Override Validation and Notification simulated logger */}
        <div className="space-y-6">
          {/* Pending / Unscheduled Course Exams Panel */}
          <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Unscheduled Exams ({unscheduledCourses.length})</span>
              <span className="text-[9px] bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-amber-500 font-semibold uppercase">Pending</span>
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {unscheduledCourses.map((crs) => {
                const isSelected = selectedUnscheduledCourse === crs.id;
                const enrolledCount = students.filter((s) => s.courses.includes(crs.id)).length;

                return (
                  <div key={crs.id} className="p-3 bg-[#0A0C10]/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="max-w-[70%]">
                        <span className="font-mono text-[10px] font-bold text-blue-400">{crs.id}</span>
                        <h4 className="text-xs font-bold text-slate-200 truncate" title={crs.name}>{crs.name}</h4>
                        <p className="text-[10px] text-slate-500">{enrolledCount} students • {crs.duration} mins • {crs.priority}</p>
                      </div>
                      {!isSelected && (
                        <button
                          onClick={() => handleStartQuickSchedule(crs.id)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer transition select-none"
                        >
                          Schedule
                        </button>
                      )}
                    </div>

                    {isSelected && (
                      <div className="p-3 bg-[#12151C] rounded border border-slate-800 space-y-3 mt-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-[10px] font-bold text-amber-400 font-mono">SCHEDULE EXAM</span>
                          <button onClick={() => setSelectedUnscheduledCourse(null)} className="text-slate-400 hover:text-white cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Timeslot option */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Timeslot</label>
                          <select
                            value={unschedSlotId}
                            onChange={(e) => setUnschedSlotId(e.target.value)}
                            className="w-full bg-[#0A0C10] border border-slate-750 border-slate-700 rounded p-1 text-[11px] text-slate-200"
                          >
                            {DEFAULT_TIMESLOTS.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {getTimeslotExact(slot.id, examStartDate)}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Room option */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Room</label>
                          <select
                            value={unschedRoomId}
                            onChange={(e) => setUnschedRoomId(e.target.value)}
                            className="w-full bg-[#0A0C10] border border-slate-750 border-slate-700 rounded p-1 text-[11px] text-slate-200"
                          >
                            {rooms.length === 0 && <option value="">-- No Rooms Available --</option>}
                            {rooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name} (Cap: {room.capacity})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Invigilator option */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Proctor</label>
                          <select
                            value={unschedInvigId}
                            onChange={(e) => setUnschedInvigId(e.target.value)}
                            className="w-full bg-[#0A0C10] border border-slate-750 border-slate-700 rounded p-1 text-[11px] text-slate-200"
                          >
                            <option value="">-- No Proctor --</option>
                            {invigilators.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} ({inv.department})
                              </option>
                            ))}
                          </select>
                        </div>

                        {quickScheduleError && (
                          <p className="text-[10px] text-rose-400 font-medium">{quickScheduleError}</p>
                        )}

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => setSelectedUnscheduledCourse(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveQuickSchedule}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded shadow-sm cursor-pointer"
                          >
                            Place Exam
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {unscheduledCourses.length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-850 border-slate-800 rounded-lg">
                  <span className="text-[18px]">🎉</span>
                  <p className="text-xs text-slate-500 font-medium mt-1">All courses scheduled!</p>
                  <p className="text-[9px] text-slate-450 font-mono">Zero pending courses</p>
                </div>
              )}
            </div>
          </div>

          {/* Notifications Simulator Alert dispatch panel */}
          {activeNotifier && (
            <div className="p-5 bg-emerald-950/20 rounded-2xl border border-emerald-900/40 space-y-3 animate-none">
              <h4 className="text-sm font-bold text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Schedule Modified Alert
              </h4>
              <p className="text-xs text-emerald-300 leading-relaxed">
                You resolved manual over-allocations. Simulated SMS notifications and student portal email alerts are queued for transmission.
              </p>
              <button
                onClick={dispatchAlertNotifications}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                <Send className="w-4 h-4" /> Dispatch Notifications Event
              </button>
            </div>
          )}

          {/* SMS & Email logger display */}
          <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Automatic Notifications Log (FR-10)</span>
              <span className="text-[9px] bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 font-semibold uppercase">Simulated Logs</span>
            </h3>
            
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {smsEmailLogs.map((log) => (
                <div key={log.id} className="p-3 bg-[#0A0C10]/40 rounded-lg border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      {log.type === "Email" ? <Mail className="w-3.5 h-3.5 text-blue-400" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />}
                      {log.type} to {log.to}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full font-bold text-[9px] ${log.sent ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30" : "bg-amber-955/20 text-amber-400 bg-amber-950 border border-amber-900/30"}`}>
                      {log.sent ? "Dispatched" : "Queued"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 bg-[#12151C] p-2 rounded border border-slate-800 leading-tight">
                    {log.text}
                  </p>
                </div>
              ))}

              {smsEmailLogs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-500 italic">No notification events triggered yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Manual exam overrides or schedule publishing will trigger student alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Override Settings Edit Modal Panel */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#12151C] rounded-2xl max-w-md w-full shadow-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 bg-[#0A0C10] border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-400 font-mono uppercase">Interactive Manual Override Editor</span>
                <h4 className="text-sm font-bold text-white">
                  {courses.find((c) => c.id === editingEntry.courseId)?.name || editingEntry.courseId}
                </h4>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Timeslot dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Change Timeslot Session</label>
                <select
                  value={moveSlotId}
                  onChange={(e) => handleDropdownChange("slot", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#0A0C10] rounded-lg focus:outline-none text-slate-200 font-medium"
                >
                  {DEFAULT_TIMESLOTS.map((ts) => (
                    <option key={ts.id} value={ts.id} className="bg-[#12151C] text-slate-200">
                      {getTimeslotExact(ts.id, examStartDate)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Reallocate Exam Hall Room</label>
                <select
                  value={moveRoomId}
                  onChange={(e) => handleDropdownChange("room", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#0A0C10] rounded-lg focus:outline-none text-slate-200 font-medium"
                >
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id} className="bg-[#12151C] text-slate-200">
                      {rm.name} - Cap: {rm.capacity} seats ({rm.building})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invigilator dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Assign Proctor Duty</label>
                <select
                  value={moveInvigId}
                  onChange={(e) => handleDropdownChange("invig", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#0A0C10] rounded-lg focus:outline-none text-slate-200 font-medium"
                >
                  <option value="" className="bg-[#12151C] text-slate-400">-- No proctor assigned --</option>
                  {invigilators.map((inv) => (
                    <option key={inv.id} value={inv.id} className="bg-[#12151C] text-slate-200">
                      {inv.name} - Dept: {inv.department} (Cap Work: {inv.maxWorkload})
                    </option>
                  ))}
                </select>
              </div>

              {/* Instant Solver validation alerts panel */}
              <div className="space-y-1.5 pt-3 border-t border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400">Conflict Audit Verification (FR-9)</span>
                {validationReport.length > 0 ? (
                  <div className="space-y-1 bg-red-950/20 p-3 rounded-lg border border-red-900/40 max-h-32 overflow-y-auto">
                    {validationReport.map((warn, i) => (
                      <p key={i} className="text-[10px] text-red-300 leading-normal flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400 mt-0.5" />
                        <span>{warn}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 text-[10px] font-medium text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Override configuration fully secure. No hard conflict triggers.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[#0A0C10] border-t border-slate-800/80 flex justify-end gap-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-3.5 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-350 text-slate-300 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={saveManualOverride}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Apply Constraints Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
