/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import { Course, Room, Student, ScheduleEntry } from "../types";
import { getBranchFullName } from "./ConfigurationTab";
import { getTimeslotExact } from "../utils/solver";
import * as XLSX from "xlsx";
import {
  Printer,
  Search,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
  BookOpen,
  MapPin,
  Calendar,
  Hash,
  Upload,
  Download,
  School,
  Image as ImageIcon,
  Check,
  RefreshCw,
  HelpCircle,
  FileSpreadsheet,
  Sliders
} from "lucide-react";

interface TicketsTabProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  entries: ScheduleEntry[];
  examStartDate?: string;
  collegeName?: string;
}

interface ExcelStudent {
  id: string;
  name: string;
  branch: string;
  year: string;
  exams: {
    courseId: string;
    courseName: string;
    dateTime: string;
    roomName: string;
    seatText: string;
  }[];
}

export default function TicketsTab({
  courses,
  rooms,
  students,
  entries,
  examStartDate = "2026-06-15",
  collegeName = "GMR Institute of Technology"
}: TicketsTabProps) {
  const [dataSource, setDataSource] = useState<"db" | "excel">("db");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Excel parsed data state
  const [excelStudents, setExcelStudents] = useState<ExcelStudent[]>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelError, setExcelError] = useState("");

  // Customization States
  const [customCollegeName, setCustomCollegeName] = useState(collegeName);
  const [collegeLogoUrl, setCollegeLogoUrl] = useState<string | null>(null);
  const [controllerSigUrl, setControllerSigUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // Group Excel Rows by Student ID
  const groupExcelData = (rows: any[]): ExcelStudent[] => {
    const studentsMap: Record<string, ExcelStudent> = {};

    rows.forEach(row => {
      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const foundKey = Object.keys(row).find(
            rk => rk.toLowerCase().replace(/[\s_-]/g, "") === k.toLowerCase()
          );
          if (foundKey && row[foundKey] !== undefined) return row[foundKey];
        }
        return "";
      };

      const id = getVal(["registernumber", "studentid", "regno", "rollno", "id"]).toString().trim();
      const name = getVal(["candidatename", "studentname", "name"]).toString().trim();
      const branch = getVal(["branch", "department", "degree", "dept"]).toString().trim();
      const year = getVal(["year", "semester", "sem"]).toString().trim();

      const courseId = getVal(["coursecode", "subjectcode", "code"]).toString().trim();
      const courseName = getVal(["coursename", "subjectname", "subject", "course"]).toString().trim();
      const dateTime = getVal(["datesession", "date", "time", "datetime", "slot"]).toString().trim();
      const roomName = getVal(["examhall", "room", "hall", "classroom"]).toString().trim();
      const seatText = getVal(["seatnumber", "seat", "seatno"]).toString().trim();

      if (!id) return; // skip empty rows

      if (!studentsMap[id]) {
        studentsMap[id] = {
          id,
          name: name || `Student ${id}`,
          branch: branch || "CSE",
          year: year || "1",
          exams: []
        };
      }

      if (courseId || courseName) {
        studentsMap[id].exams.push({
          courseId: courseId || "EXAM",
          courseName: courseName || "Scheduled Exam",
          dateTime: dateTime || "TBD",
          roomName: roomName || "Main Hall",
          seatText: seatText || "Auto-Allocated"
        });
      }
    });

    return Object.values(studentsMap);
  };

  // Excel File upload handler
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setIsParsingExcel(true);
    setExcelError("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet);

        if (jsonRows.length === 0) {
          throw new Error("The Excel sheet is empty.");
        }

        const grouped = groupExcelData(jsonRows);
        setExcelStudents(grouped);
        setDataSource("excel");
        setSelectedStudentIds(new Set()); // Clear selection
      } catch (err: any) {
        setExcelError(err.message || "Failed to parse the Excel file.");
      } finally {
        setIsParsingExcel(false);
      }
    };
    reader.onerror = () => {
      setExcelError("File reading failed.");
      setIsParsingExcel(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Image Upload Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string | null) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setter(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Download Sample Excel Template
  const downloadTemplate = () => {
    const headers = [
      {
        "Register Number": "STU-001",
        "Candidate Name": "John Doe",
        "Branch": "CSE",
        "Academic Year": "3",
        "Course Code": "CS-301",
        "Course Name": "Database Systems",
        "Date & Session": "Day-1-Morning (09:30 AM - 12:30 PM)",
        "Exam Hall": "RM-101 (Science Block A)",
        "Seat Number": "Row 1, Col 4"
      },
      {
        "Register Number": "STU-001",
        "Candidate Name": "John Doe",
        "Branch": "CSE",
        "Academic Year": "3",
        "Course Code": "CS-302",
        "Course Name": "Web Development",
        "Date & Session": "Day-2-Afternoon (01:30 PM - 04:30 PM)",
        "Exam Hall": "RM-204 (Turing Plaza)",
        "Seat Number": "Row 3, Col 2"
      },
      {
        "Register Number": "STU-002",
        "Candidate Name": "Sarah Smith",
        "Branch": "ECE",
        "Academic Year": "2",
        "Course Code": "EC-201",
        "Course Name": "Digital Electronics",
        "Date & Session": "Day-1-Evening (05:00 PM - 08:00 PM)",
        "Exam Hall": "RM-305 (Liberal Arts)",
        "Seat Number": "Row 2, Col 5"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hall Tickets Template");
    XLSX.writeFile(workbook, "hall_tickets_template.xlsx");
  };

  // Unique branches list
  const branchesList = useMemo(() => {
    const set = new Set<string>();
    if (dataSource === "db") {
      students.forEach(s => {
        const firstCourseId = s.courses[0];
        const course = courses.find(c => c.id === firstCourseId);
        if (course?.branch) set.add(course.branch);
      });
    } else {
      excelStudents.forEach(s => {
        if (s.branch) set.add(s.branch);
      });
    }
    return Array.from(set);
  }, [dataSource, students, courses, excelStudents]);

  // Student Exams mapping
  const studentExamsMap = useMemo(() => {
    const map: Record<string, { courseId: string; courseName: string; dateTimeText: string; roomName: string; seatText: string }[]> = {};

    if (dataSource === "db") {
      students.forEach(student => {
        const exams: any[] = [];
        student.courses.forEach(courseId => {
          const entry = entries.find(e => e.courseId === courseId);
          if (entry) {
            const course = courses.find(c => c.id === courseId);
            if (course) {
              const room = rooms.find(r => r.id === entry.roomId);
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
                console.error(e);
              }

              exams.push({
                courseId: course.id,
                courseName: course.name,
                dateTimeText: getTimeslotExact(entry.timeslotId, examStartDate),
                roomName: room ? `${room.name} (${room.building})` : 'Unassigned',
                seatText
              });
            }
          }
        });
        exams.sort((a, b) => a.dateTimeText.localeCompare(b.dateTimeText));
        map[student.id] = exams;
      });
    } else {
      excelStudents.forEach(student => {
        map[student.id] = student.exams.map(e => ({
          courseId: e.courseId,
          courseName: e.courseName,
          dateTimeText: e.dateTime,
          roomName: e.roomName,
          seatText: e.seatText
        }));
      });
    }

    return map;
  }, [dataSource, students, entries, courses, rooms, excelStudents, examStartDate]);

  // Filtered List
  const filteredList = useMemo(() => {
    const list = dataSource === "db" ? students : excelStudents;

    return list.filter(student => {
      let studentBranch = "CSE";
      let studentYear = "1";

      if (dataSource === "db") {
        const firstCourseId = student.courses[0];
        const course = courses.find(c => c.id === firstCourseId);
        studentBranch = course?.branch || "CSE";
        studentYear = course?.year?.toString() || "1";
      } else {
        studentBranch = student.branch;
        studentYear = (student as ExcelStudent).year;
      }

      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            student.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBranch = selectedBranch === "all" || studentBranch === selectedBranch;
      const matchesYear = selectedYear === "all" || studentYear === selectedYear;

      return matchesSearch && matchesBranch && matchesYear;
    });
  }, [dataSource, students, excelStudents, courses, searchQuery, selectedBranch, selectedYear]);

  // Selection handlers
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
    filteredList.forEach(s => next.add(s.id));
    setSelectedStudentIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  // Printable layout generator trigger
  const handlePrint = (studentIds: string[]) => {
    const printContainerId = "hall-ticket-print-container";
    let printDiv = document.getElementById(printContainerId);
    if (!printDiv) {
      printDiv = document.createElement("div");
      printDiv.id = printContainerId;
      printDiv.className = "hidden-print-area";
      document.body.appendChild(printDiv);
    }

    let htmlContent = "";
    studentIds.forEach((id, idx) => {
      const student = dataSource === "db" 
        ? students.find(s => s.id === id)
        : excelStudents.find(s => s.id === id);

      if (!student) return;
      const exams = studentExamsMap[id] || [];
      
      let branchName = "CSE";
      let year = "1";
      if (dataSource === "db") {
        const firstCourse = courses.find(c => c.id === student.courses[0]);
        branchName = getBranchFullName(firstCourse?.branch || "CSE");
        year = (firstCourse?.year || 1).toString();
      } else {
        branchName = getBranchFullName(student.branch);
        year = (student as ExcelStudent).year;
      }

      const logoHtml = collegeLogoUrl 
        ? `<img src="${collegeLogoUrl}" class="college-logo-img" />`
        : `<div class="college-logo-placeholder">🎓</div>`;

      const sigHtml = controllerSigUrl
        ? `<img src="${controllerSigUrl}" class="controller-sig-img" />`
        : `<div class="sig-space"></div>`;

      htmlContent += `
        <div class="printable-ticket-card">
          <div class="ticket-header">
            ${logoHtml}
            <div class="college-title-block">
              <h1 class="college-name">${customCollegeName}</h1>
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
                  <td class="info-value">Year ${year} (Semester ${Number(year) * 2 - 1})</td>
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
                    <td class="font-mono">${ex.courseId}</td>
                    <td>${ex.courseName}</td>
                    <td>${ex.dateTimeText}</td>
                    <td>${ex.roomName}</td>
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
              ${sigHtml}
              <p>Controller of Examinations</p>
            </div>
          </div>
        </div>
        ${idx < studentIds.length - 1 ? '<div class="page-break"></div>' : ''}
      `;
    });

    printDiv.innerHTML = htmlContent;
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CSS Stylesheet injected for printable output */}
      <style>{`
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
            gap: 15px;
          }
          .college-logo-placeholder {
            font-size: 28px;
            margin-right: 5px;
          }
          .college-logo-img {
            max-height: 48px;
            max-width: 48px;
            object-fit: contain;
          }
          .controller-sig-img {
            max-height: 35px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
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
      <div className="bg-[#12151C] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap gap-4 items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Student Hall Tickets</h1>
          </div>
          <p className="text-xs text-slate-400">
            Generate and print official semester examination hall tickets for candidates using local database schedules or imported seating Excel files.
          </p>
        </div>

        {/* Data Source Selector */}
        <div className="flex items-center gap-2.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setDataSource("db")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
              dataSource === "db"
                ? "bg-slate-800 text-white border border-slate-700/60 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <School className="w-3.5 h-3.5" /> Database Schedule
          </button>
          <button
            onClick={() => setDataSource("excel")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer select-none ${
              dataSource === "excel"
                ? "bg-slate-800 text-white border border-slate-700/60 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Custom Seating Sheet
          </button>
        </div>
      </div>

      {/* Custom Template Customization Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Custom Seating Sheet Uploader */}
        {dataSource === "excel" && (
          <div className="p-6 rounded-2xl bg-[#12151C] border border-slate-800 lg:col-span-6 space-y-4 shadow-xl flex flex-col justify-between min-h-[190px]">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Upload Custom Sheet</h2>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-bold border border-slate-750 flex items-center gap-0.5 transition cursor-pointer select-none"
                >
                  <Download className="w-2.5 h-2.5" /> Download Template
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Upload a custom Excel spreadsheet (.xlsx, .xls) containing seating arrangements and exam details to instantly design and print student hall tickets from it.
              </p>
              {excelError && (
                <div className="mt-3 p-2 bg-red-950/20 border border-red-900/40 rounded-lg text-[10px] text-red-400 font-semibold">
                  ⚠️ {excelError}
                </div>
              )}
            </div>

            <div className="pt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingExcel}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20 cursor-pointer select-none"
              >
                {isParsingExcel ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Parsing Custom Sheet...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> {excelFileName ? `Change File (${excelFileName})` : "Upload Custom Excel Sheet"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Right: Hall Ticket Header Logo / Signatures customization */}
        <div className={`p-6 rounded-2xl bg-[#12151C] border border-slate-800 shadow-xl space-y-4 ${
          dataSource === "excel" ? "lg:col-span-6" : "lg:col-span-12"
        }`}>
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Customize Hall Tickets Layout</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wide">College Header Name</label>
              <input
                type="text"
                value={customCollegeName}
                onChange={(e) => setCustomCollegeName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-850 bg-[#0A0C10] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-550"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Upload College Logo</label>
              <input
                type="file"
                ref={logoInputRef}
                onChange={(e) => handleImageUpload(e, setCollegeLogoUrl)}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full px-3 py-2 text-xs border border-slate-850 bg-[#0A0C10] hover:bg-slate-900 text-slate-300 rounded-lg transition flex items-center justify-between cursor-pointer"
              >
                <span className="truncate max-w-[120px]">{collegeLogoUrl ? "Logo Loaded ✅" : "Choose Logo Image"}</span>
                <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Controller Signature</label>
              <input
                type="file"
                ref={sigInputRef}
                onChange={(e) => handleImageUpload(e, setControllerSigUrl)}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => sigInputRef.current?.click()}
                className="w-full px-3 py-2 text-xs border border-slate-850 bg-[#0A0C10] hover:bg-slate-900 text-slate-300 rounded-lg transition flex items-center justify-between cursor-pointer"
              >
                <span className="truncate max-w-[120px]">{controllerSigUrl ? "Signature Loaded ✅" : "Choose Signature Image"}</span>
                <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </div>
          </div>
        </div>
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
              {branchesList.map(b => (
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
          {selectedStudentIds.size > 0 && (
            <button
              onClick={() => handlePrint(Array.from(selectedStudentIds))}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-md shadow-emerald-950/20 cursor-pointer select-none"
            >
              <Printer className="w-3.5 h-3.5" /> Print Selected ({selectedStudentIds.size})
            </button>
          )}
          <button
            onClick={handleSelectAllVisible}
            className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold border border-slate-700/40 cursor-pointer select-none"
          >
            Select All Visible ({filteredList.length})
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold border border-slate-700/40 cursor-pointer select-none"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Grid of Student Hall Ticket Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredList.map(student => {
          const exams = studentExamsMap[student.id] || [];
          const isSelected = selectedStudentIds.has(student.id);
          
          let branchName = "CSE";
          let year = "1";
          if (dataSource === "db") {
            const firstCourse = courses.find(c => c.id === student.courses[0]);
            branchName = getBranchFullName(firstCourse?.branch || "CSE");
            year = (firstCourse?.year || 1).toString();
          } else {
            branchName = getBranchFullName(student.branch);
            year = (student as ExcelStudent).year;
          }

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
                    Photo
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-white leading-tight">{student.name}</h2>
                    <p className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider">{student.id}</p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] text-slate-400 font-semibold text-ellipsis max-w-[150px] truncate" title={branchName}>
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
                    {exams.map((ex, sidx) => (
                      <div key={sidx} className="p-2.5 rounded-lg bg-[#0A0C10]/40 border border-slate-800/60 flex items-center justify-between gap-4 text-[11px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-white font-bold">{ex.courseId}</span>
                            <span className="text-slate-400 truncate max-w-[150px]" title={ex.courseName}>{ex.courseName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3 shrink-0" /> {ex.dateTimeText}</span>
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" /> {ex.roomName}</span>
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

        {filteredList.length === 0 && (
          <div className="col-span-2 text-center py-20 border border-dashed border-slate-800 rounded-3xl space-y-3">
            {dataSource === "excel" && excelStudents.length === 0 ? (
              <>
                <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 italic">Please upload a custom Excel Seating Sheet to generate tickets.</p>
              </>
            ) : (
              <>
                <UserCheck className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 italic">No students matched the selected search filters.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
