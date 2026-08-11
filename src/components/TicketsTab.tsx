/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Course, Room, Student, ScheduleEntry } from "../types";
import { getBranchFullName } from "./ConfigurationTab";
import { getTimeslotExact } from "../utils/solver";
import { Printer, Search, Filter, CheckSquare, Square, UserCheck, BookOpen, MapPin, Calendar, Hash, Check } from "lucide-react";

interface TicketsTabProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  entries: ScheduleEntry[];
  examStartDate?: string;
  collegeName?: string;
}

export default function TicketsTab({
  courses,
  rooms,
  students,
  entries,
  examStartDate = "2026-06-15",
  collegeName = "GMR Institute of Technology"
}: TicketsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Unique branches from students list
  const studentBranches = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      // Find their first course branch or default to CSE
      const firstCourseId = s.courses[0];
      const course = courses.find(c => c.id === firstCourseId);
      if (course?.branch) set.add(course.branch);
    });
    return Array.from(set);
  }, [students, courses]);

  // Helper: Find all exams a student has scheduled
  const studentExams = useMemo(() => {
    const map: Record<string, { entry: ScheduleEntry; course: Course; room?: Room; seatText: string }[]> = {};

    students.forEach(student => {
      const exams: typeof map[string] = [];
      student.courses.forEach(courseId => {
        // Find if this course has a schedule entry
        const entry = entries.find(e => e.courseId === courseId);
        if (entry) {
          const course = courses.find(c => c.id === courseId);
          if (course) {
            const room = rooms.find(r => r.id === entry.roomId);
            
            // Look up custom seating seat coordinates
            let seatText = "Auto-Allocated";
            try {
              const savedSeating = localStorage.getItem("exam_scheduler_custom_seating");
              if (savedSeating) {
                const seatingData = JSON.parse(savedSeating);
                const seatKey = `${entry.timeslotId}_${entry.roomId}`;
                const arrangement = seatingData[seatKey];
                if (arrangement && Array.isArray(arrangement)) {
                  const idx = arrangement.indexOf(student.id);
                  if (idx !== -1) {
                    const gridSaved = localStorage.getItem("exam_scheduler_grid_configs");
                    let numCols = 6;
                    if (gridSaved) {
                      const gridData = JSON.parse(gridSaved);
                      if (gridData[seatKey] && gridData[seatKey].numCols) {
                        numCols = gridData[seatKey].numCols;
                      }
                    }
                    const row = Math.floor(idx / numCols) + 1;
                    const col = (idx % numCols) + 1;
                    seatText = `Row ${row}, Col ${col}`;
                  }
                }
              }
            } catch (e) {
              console.error("Error looking up seat", e);
            }

            exams.push({ entry, course, room, seatText });
          }
        }
      });
      // Sort exams by slot sequence or timeslotId
      exams.sort((a, b) => a.entry.timeslotId.localeCompare(b.entry.timeslotId));
      map[student.id] = exams;
    });

    return map;
  }, [students, entries, courses, rooms]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Find branch/year from first course
      const firstCourseId = student.courses[0];
      const course = courses.find(c => c.id === firstCourseId);
      const studentBranch = course?.branch || "CSE";
      const studentYear = course?.year?.toString() || "1";

      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            student.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBranch = selectedBranch === "all" || studentBranch === selectedBranch;
      const matchesYear = selectedYear === "all" || studentYear === selectedYear;

      return matchesSearch && matchesBranch && matchesYear;
    });
  }, [students, courses, searchQuery, selectedBranch, selectedYear]);

  // Select / Deselect Handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedStudentIds);
    filteredStudents.forEach(s => next.add(s.id));
    setSelectedStudentIds(next);
  };

  const handleDeselectAllVisible = () => {
    const next = new Set(selectedStudentIds);
    filteredStudents.forEach(s => next.delete(s.id));
    setSelectedStudentIds(next);
  };

  // Helper: Trigger browser print
  const handlePrint = (studentIds: string[]) => {
    // Create print container
    const printContainerId = "hall-ticket-print-container";
    let printDiv = document.getElementById(printContainerId);
    if (!printDiv) {
      printDiv = document.createElement("div");
      printDiv.id = printContainerId;
      printDiv.className = "hidden-print-area";
      document.body.appendChild(printDiv);
    }

    // Populate tickets
    let htmlContent = "";
    studentIds.forEach((id, idx) => {
      const student = students.find(s => s.id === id);
      if (!student) return;
      const exams = studentExams[id] || [];
      const firstCourse = courses.find(c => c.id === student.courses[0]);
      const branchName = getBranchFullName(firstCourse?.branch || "CSE");
      const year = firstCourse?.year || 1;

      htmlContent += `
        <div class="printable-ticket-card">
          <div class="ticket-header">
            <div class="college-logo-placeholder">🎓</div>
            <div class="college-title-block">
              <h1 class="college-name">${collegeName}</h1>
              <h2 class="exam-title">OFFICIAL SEMESTER EXAMINATION HALL TICKET - 2026</h2>
            </div>
          </div>

          <div class="student-info-grid">
            <div class="student-photo-box">
              <div class="avatar-placeholder">PHOTO</div>
            </div>
            <div class="info-details">
              <table class="info-table">
                <tr>
                  <td class="info-label">Candidate Name:</td>
                  <td class="info-value font-bold">${student.name}</td>
                </tr>
                <tr>
                  <td class="info-label">Register Number:</td>
                  <td class="info-value font-mono font-bold">${student.id}</td>
                </tr>
                <tr>
                  <td class="info-label">Degree / Branch:</td>
                  <td class="info-value">${branchName}</td>
                </tr>
                <tr>
                  <td class="info-label">Academic Year:</td>
                  <td class="info-value">Year ${year} (Semester ${year * 2 - 1})</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="exam-schedule-section">
            <h3 class="section-title">Schedule of Examination</h3>
            <table class="exam-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Date & Session</th>
                  <th>Exam Hall</th>
                  <th>Seat Number</th>
                </tr>
              </thead>
              <tbody>
                ${exams.map(ex => `
                  <tr>
                    <td class="font-mono">${ex.course.id}</td>
                    <td>${ex.course.name}</td>
                    <td>${getTimeslotExact(ex.entry.timeslotId, examStartDate)}</td>
                    <td>${ex.room ? `${ex.room.name} (${ex.room.building})` : 'Unassigned'}</td>
                    <td class="font-bold text-center">${ex.seatText}</td>
                  </tr>
                `).join('')}
                ${exams.length === 0 ? `
                  <tr>
                    <td colspan="5" class="text-center italic text-muted">No examinations scheduled for this student.</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          <div class="instructions-section">
            <h4 class="instructions-title">Instructions to the Candidate:</h4>
            <ol class="instructions-list">
              <li>Candidates must bring this Hall Ticket and College ID Card to every examination session.</li>
              <li>Candidates are required to occupy their designated seats 15 minutes before the start of the exam.</li>
              <li>Calculators, mobile phones, smartwatches, and other unauthorized electronic gadgets are strictly prohibited inside the hall.</li>
            </ol>
          </div>

          <div class="signatures-block">
            <div class="sig-line">
              <div class="sig-space"></div>
              <p>Signature of the Candidate</p>
            </div>
            <div class="sig-line text-right">
              <div class="sig-space"></div>
              <p>Controller of Examinations</p>
            </div>
          </div>
        </div>
        ${idx < studentIds.length - 1 ? '<div class="page-break"></div>' : ''}
      `;
    });

    printDiv.innerHTML = htmlContent;

    // Trigger Print
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CSS Stylesheet injected for printable output */}
      <style>{`
        /* Print Stylesheet overrides */
        @media print {
          body * {
            visibility: hidden;
          }
          #hall-ticket-print-container, #hall-ticket-print-container * {
            visibility: visible;
          }
          #hall-ticket-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .printable-ticket-card {
            border: 2px double #333;
            padding: 20px;
            margin-bottom: 20px;
            background: white !important;
            color: black !important;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          .ticket-header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .college-logo-placeholder {
            font-size: 28px;
            margin-right: 15px;
          }
          .college-name {
            font-size: 16px;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .exam-title {
            font-size: 11px;
            margin: 3px 0 0 0;
            color: #444;
            font-weight: bold;
          }
          .student-info-grid {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
          }
          .student-photo-box {
            width: 90px;
            height: 105px;
            border: 1px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: #666;
            font-weight: bold;
            background: #f8f9fa;
          }
          .info-details {
            flex-grow: 1;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-table td {
            padding: 3px 5px;
            font-size: 11px;
            vertical-align: top;
          }
          .info-label {
            font-weight: bold;
            width: 120px;
            color: #333;
          }
          .info-value {
            color: #111;
          }
          .font-bold {
            font-weight: bold;
          }
          .font-mono {
            font-family: monospace;
          }
          .section-title {
            font-size: 12px;
            font-weight: bold;
            border-bottom: 1px solid #333;
            padding-bottom: 4px;
            margin: 15px 0 8px 0;
            text-transform: uppercase;
          }
          .exam-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .exam-table th, .exam-table td {
            border: 1px solid #333;
            padding: 5px 8px;
            font-size: 10px;
            text-align: left;
          }
          .exam-table th {
            background-color: #f1f3f5 !important;
            font-weight: bold;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center {
            text-align: center !important;
          }
          .instructions-section {
            border: 1px dashed #555;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 25px;
          }
          .instructions-title {
            font-size: 10px;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .instructions-list {
            margin: 0;
            padding-left: 15px;
            font-size: 9px;
            line-height: 1.35;
          }
          .signatures-block {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .sig-line {
            width: 200px;
            text-align: center;
          }
          .sig-space {
            height: 35px;
          }
          .sig-line p {
            border-top: 1px solid #333;
            margin: 0;
            padding-top: 4px;
            font-size: 10px;
            font-weight: bold;
          }
          .text-right {
            text-align: right !important;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Student Hall Tickets</h1>
          </div>
          <p className="text-xs text-slate-400">
            Generate, customize, and print official semester examination hall tickets for candidates complete with schedule details and seat numbers.
          </p>
        </div>
        {selectedStudentIds.size > 0 && (
          <button
            onClick={() => handlePrint(Array.from(selectedStudentIds))}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer select-none"
          >
            <Printer className="w-4 h-4" /> Print Selected Tickets ({selectedStudentIds.size})
          </button>
        )}
      </div>

      {/* Filter and Selection Toolbar */}
      <div className="bg-[#12151C] p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap gap-4 items-center justify-between">
        {/* Left: filters */}
        <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search candidate name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-800 bg-[#0A0C10] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0A0C10] border border-slate-800 text-[11px] rounded-lg text-slate-300 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">View All Branches</option>
              {studentBranches.map(b => (
                <option key={b} value={b}>{getBranchFullName(b)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0A0C10] border border-slate-800 text-[11px] rounded-lg text-slate-300 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">View All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAllVisible}
            className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold border border-slate-700/40 cursor-pointer select-none"
          >
            Select All Visible ({filteredStudents.length})
          </button>
          <button
            onClick={handleDeselectAllVisible}
            className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold border border-slate-700/40 cursor-pointer select-none"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Grid of Student Hall Ticket previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStudents.map(student => {
          const exams = studentExams[student.id] || [];
          const isSelected = selectedStudentIds.has(student.id);
          const firstCourse = courses.find(c => c.id === student.courses[0]);
          const branchName = getBranchFullName(firstCourse?.branch || "CSE");
          const year = firstCourse?.year || 1;

          return (
            <div
              key={student.id}
              className={`p-6 rounded-2xl bg-[#12151C] border transition shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[360px] ${
                isSelected ? "border-blue-500 bg-blue-950/5" : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Checkbox selection in top right */}
              <button
                type="button"
                onClick={() => handleToggleSelect(student.id)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer select-none"
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-500 fill-blue-500/10" />
                ) : (
                  <Square className="w-5 h-5 text-slate-600" />
                )}
              </button>

              {/* Ticket header block */}
              <div>
                <div className="flex items-start gap-3 border-b border-slate-800/70 pb-4 mb-4">
                  <div className="w-12 h-14 bg-slate-800 rounded border border-slate-700 flex items-center justify-center text-[9px] text-slate-500 font-bold select-none shrink-0 uppercase">
                    Avatar
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-white leading-tight">{student.name}</h2>
                    <p className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider">{student.id}</p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-slate-400 font-semibold">
                        {branchName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/40 text-[9px] text-indigo-400 font-semibold">
                        Year {year}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exam schedule details list */}
                <div className="space-y-3">
                  <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Scheduled Examinations ({exams.length})</h3>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {exams.map(ex => (
                      <div key={ex.course.id} className="p-2.5 rounded-lg bg-[#0A0C10]/40 border border-slate-800/60 flex items-center justify-between gap-4 text-[11px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-white font-bold">{ex.course.id}</span>
                            <span className="text-slate-400 truncate max-w-[150px]" title={ex.course.name}>{ex.course.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3 shrink-0" /> {getTimeslotExact(ex.entry.timeslotId, examStartDate)}</span>
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" /> {ex.room ? ex.room.name : 'Unassigned'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold font-mono text-[10px] flex items-center gap-0.5">
                            <Hash className="w-3 h-3" /> {ex.seatText}
                          </span>
                        </div>
                      </div>
                    ))}
                    {exams.length === 0 && (
                      <p className="text-[11px] text-slate-600 italic">No exams scheduled for this student.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom ticket printing footer */}
              <div className="border-t border-slate-800/70 pt-4 mt-4 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 italic">Official Controller Seal Pending</span>
                <button
                  onClick={() => handlePrint([student.id])}
                  className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer select-none"
                >
                  <Printer className="w-3.5 h-3.5" /> Print This Ticket
                </button>
              </div>
            </div>
          );
        })}

        {filteredStudents.length === 0 && (
          <div className="col-span-2 text-center py-20 border border-dashed border-slate-800 rounded-3xl space-y-3">
            <UserCheck className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 italic">No students matched the selected search filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
