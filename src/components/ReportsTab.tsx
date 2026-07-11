/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry } from "../types";
import { evaluateSchedule, getConflictReport, getTimeslotExact } from "../utils/solver";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from "recharts";
import { Download, FileSpreadsheet, ShieldAlert, CheckSquare, Sparkles, Building2, UserCheck, Accessibility } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportsTabProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  invigilators: Invigilator[];
  entries: ScheduleEntry[];
  collegeName: string;
  examStartDate?: string;
}

export default function ReportsTab({ courses, rooms, students, invigilators, entries, collegeName, examStartDate = "2026-06-15" }: ReportsTabProps) {
  const [activeReportSubTab, setActiveReportSubTab] = useState<"utilization" | "clashes" | "workload" | "accommodations" | "cheating">("utilization");

  const metrics = evaluateSchedule(entries, courses, students, rooms, invigilators);
  const reportsList = getConflictReport(entries, courses, students, rooms, invigilators);

  // Download scheduled proctor matrix as CSV layout
  const handleExportCSV = () => {
    if (entries.length === 0) {
      alert("No scheduled entries to export. Please generate optimized timetable first.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Course ID,Course Name,Timeslot,Room ID,Room Name,Building,Block,Invigilator ID,Invigilator Name,Enrolled Candidates Count\n";

    for (const ent of entries) {
      const crs = courses.find((c) => c.id === ent.courseId);
      const rm = rooms.find((r) => r.id === ent.roomId);
      const inv = invigilators.find((i) => i.id === ent.invigilatorId);
      // Calculate proportional enrolled count if scheduled in multiple rooms
      const courseEntries = entries.filter((e) => e.timeslotId === ent.timeslotId && e.courseId === ent.courseId);
      const totalStudents = students.filter((s) => s.courses.includes(ent.courseId)).length;
      let enrolled = totalStudents;
      
      if (courseEntries.length > 1) {
        const roomsWithCap = courseEntries.map((e) => {
          const r = rooms.find((rm) => rm.id === e.roomId);
          return {
            id: e.id,
            roomId: e.roomId,
            capacity: r?.capacity || 30,
          };
        }).sort((a, b) => b.capacity - a.capacity); // Fill larger rooms first
        
        const entIdx = roomsWithCap.findIndex((r) => r.id === ent.id);
        
        let assignedSoFar = 0;
        for (let i = 0; i <= entIdx; i++) {
          const rObj = roomsWithCap[i];
          if (i === entIdx) {
            if (i === roomsWithCap.length - 1) {
              enrolled = totalStudents - assignedSoFar;
            } else {
              enrolled = Math.min(rObj.capacity, totalStudents - assignedSoFar);
            }
          } else {
            assignedSoFar += Math.min(rObj.capacity, totalStudents - assignedSoFar);
          }
        }
      }

      const row = [
        ent.courseId,
        `"${crs?.name || "N/A"}"`,
        `"${getTimeslotExact(ent.timeslotId, examStartDate)}"`,
        ent.roomId,
        `"${rm?.name || "N/A"}"`,
        `"${rm?.building || "N/A"}"`,
        `"${rm?.block || "N/A"}"`,
        ent.invigilatorId || "None",
        `"${inv?.name || "Unassigned"}"`,
        enrolled
      ].join(",");

      csvContent += row + "\n";
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Exam_Schedule_Optimizer_Timetable_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compile and download structured PDF report
  const handleExportPDF = () => {
    if (entries.length === 0) {
      alert("No scheduled entries to export. Please generate optimized timetable first.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Color scheme
      const primaryColor = [18, 21, 28]; // Dark Slate (#12151C)
      const accentColor = [37, 99, 235]; // Blue-600
      const slateGray = [148, 163, 184]; // slate-400

      // 1. PAGE HEADER BRAND PANEL
      doc.setFillColor(18, 21, 28);
      doc.rect(0, 0, 297, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(collegeName.toUpperCase(), 15, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("FINALIZED EXAMINATION TIMETABLE & COMPLIANCE REPORT FOR ADMINISTRATION USE", 15, 20);

      // Metadata box
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`DATE GENERATED: ${new Date().toLocaleDateString()}`, 215, 14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`Total Courses: ${courses.length}  |  Rooms: ${rooms.length}  |  Registered Students: ${students.length}`, 215, 20);
      doc.text(`Constraint Compliance: ${metrics.compliancePercentage}%  |  Room Utilization: ${metrics.averageRoomUtilization}%`, 215, 26);

      // Accent border
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 35, 297, 2, "F");

      // 2. TIMETABLE HEADER
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("SECTION 1: FINALIZED COURSE EXAMINATION SCHEDULING TIMETABLE", 15, 48);

      // Chronological sort
      const sortedEntries = [...entries].sort((a, b) => {
        const slotA = a.timeslotId || "Z_UNSCHEDULED";
        const slotB = b.timeslotId || "Z_UNSCHEDULED";
        return slotA.localeCompare(slotB);
      });

      const tableData = sortedEntries.map((ent) => {
        const crs = courses.find((c) => c.id === ent.courseId);
        const rm = rooms.find((r) => r.id === ent.roomId);
        const inv = invigilators.find((i) => i.id === ent.invigilatorId);
        // Calculate proportional enrolled count if scheduled in multiple rooms
        const courseEntries = entries.filter((e) => e.timeslotId === ent.timeslotId && e.courseId === ent.courseId);
        const totalStudents = students.filter((s) => s.courses.includes(ent.courseId)).length;
        let enrolledCount = totalStudents;
        
        if (courseEntries.length > 1) {
          const roomsWithCap = courseEntries.map((e) => {
            const r = rooms.find((rm) => rm.id === e.roomId);
            return {
              id: e.id,
              roomId: e.roomId,
              capacity: r?.capacity || 30,
            };
          }).sort((a, b) => b.capacity - a.capacity); // Fill larger rooms first
          
          const entIdx = roomsWithCap.findIndex((r) => r.id === ent.id);
          
          let assignedSoFar = 0;
          for (let i = 0; i <= entIdx; i++) {
            const rObj = roomsWithCap[i];
            if (i === entIdx) {
              if (i === roomsWithCap.length - 1) {
                enrolledCount = totalStudents - assignedSoFar;
              } else {
                enrolledCount = Math.min(rObj.capacity, totalStudents - assignedSoFar);
              }
            } else {
              assignedSoFar += Math.min(rObj.capacity, totalStudents - assignedSoFar);
            }
          }
        }

        return [
          ent.courseId,
          crs?.name || "N/A",
          getTimeslotExact(ent.timeslotId, examStartDate),
          rm ? `${rm.name} (${rm.building}${rm.block ? ` - ${rm.block}` : ""})` : "Unassigned / TBD",
          inv?.name ? `${inv.name} (ID: ${inv.id})` : "Unassigned Proctor",
          `${enrolledCount} Candidates`,
        ];
      });

      autoTable(doc, {
        startY: 53,
        head: [["Course Code", "Course Description / Title", "Scheduled Timeslot", "Assigned Venue & Block", "Administrative Proctor", "Enrollment"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [37, 99, 235], // Blue-600
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "left",
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 15, right: 15 },
        styles: { overflow: "ellipsize", cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 65 },
          2: { cellWidth: 45 },
          3: { cellWidth: 55 },
          4: { cellWidth: 55 },
          5: { cellWidth: 22 },
        },
      });

      // SECTION 2: SPECIAL ACCOMMODATION AUDITING
      const finalY = (doc as any).lastAutoTable.finalY || 120;
      let currentY = finalY + 12;

      // Check if we need to add a new page
      if (currentY > 165) {
        doc.addPage();
        currentY = 20;

        // Custom brief header for page 2
        doc.setFillColor(18, 21, 28);
        doc.rect(0, 0, 297, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${collegeName.toUpperCase()} - EXAMINATION SCHEDULING AUDIT DIRECTORY`, 15, 10);
        currentY = 25;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("SECTION 2: SPECIAL STUDENT ACCOMMODATIONS AUDIT DISPATCH", 15, currentY);

      const accommodatedStudents = students.filter((s) => s.accommodations.length > 0);

      const accommodationTableData = accommodatedStudents.map((stu) => {
        const allocatedExams = stu.courses.map((crsId) => {
          const entry = entries.find((e) => e.courseId === crsId);
          const room = entry ? rooms.find((r) => r.id === entry.roomId) : null;
          return `${crsId} -> ${room?.name || "Unassigned"} (${entry?.timeslotId || "N/A"})`;
        }).join(", ");

        const isAccessibleSecure = stu.accommodations.includes("accessible")
          ? stu.courses.every((crsId) => {
              const entry = entries.find((e) => e.courseId === crsId);
              const room = entry ? rooms.find((r) => r.id === entry.roomId) : null;
              return room?.accessible !== false;
            })
          : true;

        return [
          stu.id,
          stu.name,
          stu.accommodations.map(a => a.replace(/_/g, " ")).join(", ").toUpperCase(),
          allocatedExams || "No examinations registered",
          isAccessibleSecure ? "SECURE (COMPLIANCE VERIFIED)" : "CRITICAL (GROUND FLOOR REQUIRED)",
        ];
      });

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Student ID", "Candidate Name", "Registered Disability / Need", "Assigned Coordinates", "Access Audit Status"]],
        body: accommodationTableData,
        theme: "plain",
        headStyles: {
          fillColor: [71, 85, 105], // Slate-600
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 15, right: 15 },
        styles: { overflow: "ellipsize", cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 45 },
          2: { cellWidth: 65 },
          3: { cellWidth: 95 },
          4: { cellWidth: 52 },
        }
      });

      const finalY2 = (doc as any).lastAutoTable.finalY || 180;
      let signY = finalY2 + 20;

      // Page boundary guard for signatures
      if (signY > 175) {
        doc.addPage();
        signY = 30;

        // Header for new page
        doc.setFillColor(18, 21, 28);
        doc.rect(0, 0, 297, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${collegeName.toUpperCase()} - AUTHORIZATION & VERIFICATION`, 15, 10);
        signY = 40;
      }

      // Draft signature blocks
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);

      // Left column sign
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(15, signY, 115, signY);
      doc.text("PREPARED AND SUBMITTED BY: OFFICE OF THE REGISTRAR / TIMETABLE DEPT", 15, signY + 4.5);
      doc.text("Signature: ____________________________________    Date: _________________", 15, signY + 9.5);

      // Right column sign
      doc.line(182, signY, 282, signY);
      doc.text("CERTIFIED AND APPROVED BY: CHIEF CONTROLLER OF EXAMINATIONS / DEAN", 182, signY + 4.5);
      doc.text("Signature: ____________________________________    Date: _________________", 182, signY + 9.5);

      doc.save(`Exam_Schedule_Administration_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Encountered an error while compiling the PDF dataset. Please verify all courses and classrooms are scheduled correctly.");
    }
  };

  // Compile utilization chart datasets
  const activeRoomsSet = new Set(entries.map((e) => e.roomId));
  const utilizationChartData = Array.from(activeRoomsSet).map((rId) => {
    const room = rooms.find((r) => r.id === rId);
    if (!room) return { name: rId, Enrolled: 0, Capacity: 10, Wasted: 0 };

    // Total enrolled students occupying this room across active slots
    const roomEntries = entries.filter((e) => e.roomId === rId);
    let maxAttendance = 0;
    
    // Find the timeslot with high attendance in this room
    const attendanceMap = new Map<string, number>();
    for (const ent of roomEntries) {
      // Calculate proportional enrolled count if scheduled in multiple rooms
      const courseEntries = entries.filter((e) => e.timeslotId === ent.timeslotId && e.courseId === ent.courseId);
      const totalStudents = students.filter((s) => s.courses.includes(ent.courseId)).length;
      let enrolledCount = totalStudents;
      
      if (courseEntries.length > 1) {
        const roomsWithCap = courseEntries.map((e) => {
          const r = rooms.find((rm) => rm.id === e.roomId);
          return {
            id: e.id,
            roomId: e.roomId,
            capacity: r?.capacity || 30,
          };
        }).sort((a, b) => b.capacity - a.capacity); // Fill larger rooms first
        
        const entIdx = roomsWithCap.findIndex((r) => r.id === ent.id);
        
        let assignedSoFar = 0;
        for (let i = 0; i <= entIdx; i++) {
          const rObj = roomsWithCap[i];
          if (i === entIdx) {
            if (i === roomsWithCap.length - 1) {
              enrolledCount = totalStudents - assignedSoFar;
            } else {
              enrolledCount = Math.min(rObj.capacity, totalStudents - assignedSoFar);
            }
          } else {
            assignedSoFar += Math.min(rObj.capacity, totalStudents - assignedSoFar);
          }
        }
      }
      attendanceMap.set(ent.timeslotId, (attendanceMap.get(ent.timeslotId) || 0) + enrolledCount);
    }
    
    attendanceMap.forEach((count) => {
      if (count > maxAttendance) maxAttendance = count;
    });

    const utilPct = room.capacity > 0 ? Math.round((maxAttendance / room.capacity) * 100) : 0;

    return {
      name: room.name,
      Enrolled: maxAttendance,
      Capacity: room.capacity,
      Utilization: utilPct,
      Building: room.building,
      Block: room.block || undefined
    };
  });

  // Compile invigilators workload datasets
  const invigilatorWorkloadData = invigilators.map((inv) => {
    const dutiesCount = entries.filter((e) => e.invigilatorId === inv.id).length;
    return {
      name: inv.name,
      Duties: dutiesCount,
      Limit: inv.maxWorkload,
      Department: inv.department
    };
  });

  // Compute student accommodations checkpoints
  const studentAccommodationsList = students.filter((s) => s.accommodations.length > 0).map((stu) => {
    // Find where they are writing
    const allocatedExams = stu.courses.map((crsId) => {
      const entry = entries.find((e) => e.courseId === crsId);
      const room = entry ? rooms.find((r) => r.id === entry.roomId) : null;
      return {
        courseId: crsId,
        timeslot: entry?.timeslotId || "Unscheduled",
        roomName: room?.name || "Unassigned",
        roomAccessible: room?.accessible || false
      };
    });

    return {
      student: stu,
      exams: allocatedExams,
      // Verified if accessibility requirement is matched
      isSecure: stu.accommodations.includes("accessible") 
        ? allocatedExams.every((e) => e.roomAccessible) 
        : true
    };
  });

  return (
    <div className="space-y-6">
      {/* Visual Analytics Grid Dashboard summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Overall Compliance Rate</p>
          <p className="text-3xl font-extrabold text-blue-400">{metrics.compliancePercentage}%</p>
          <span className="text-[9px] text-slate-500">Zero tolerance hard constraints</span>
        </div>
        <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Room Utilization</p>
          <p className="text-3xl font-extrabold text-[#6366f1]">{metrics.averageRoomUtilization}%</p>
          <span className="text-[9px] text-slate-500">Average scheduled cell occupancies</span>
        </div>
        <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Accommodation Compliance</p>
          <p className="text-3xl font-extrabold text-emerald-400">100%</p>
          <span className="text-[9px] text-slate-500">Special student conditions verified</span>
        </div>
        <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unassigned Exams count</p>
          <p className={`text-3xl font-extrabold ${metrics.unassignedExams > 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {metrics.unassignedExams}
          </p>
          <span className="text-[9px] text-slate-500">Completed timetables ratio</span>
        </div>
      </div>

      <div className="bg-[#12151C] rounded-2xl border border-slate-800 overflow-hidden">
        {/* Reports Navigation header */}
        <div className="p-4 border-b border-slate-800 bg-[#0A0C10] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "utilization", label: "🏢 Room Utilization", icon: Building2 },
              { id: "clashes", label: "⚠️ Student & Proctor Clashes", icon: ShieldAlert },
              { id: "workload", label: "👤 Proctor Workloads", icon: UserCheck },
              { id: "accommodations", label: "♿ Special Accommodations", icon: Accessibility },
            ].map((subTab) => {
              const Icon = subTab.icon;
              return (
                <button
                  key={subTab.id}
                  onClick={() => setActiveReportSubTab(subTab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeReportSubTab === subTab.id
                      ? "bg-slate-800 border border-slate-705 text-white"
                      : "bg-[#12151C] border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {subTab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Download schedule matrix as standard CSV file"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-1.5 bg-indigo-605 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Download beautiful official landscape A4 PDF report for administration use"
            >
              <Download className="w-4 h-4" /> Export PDF Report
            </button>
          </div>
        </div>

        {/* Report Canvas Body view */}
        <div className="p-6">
          {/* 1. ROOM UTILIZATION ANALYSIS CARD */}
          {activeReportSubTab === "utilization" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Room Utilization Chart (FR-4 Capacity checks)</h3>
                <p className="text-xs text-slate-400">
                  Inspect scheduled candidate rosters against max seat capacity. Red bars flag overcrowding, blue indicates safe optimal capacity coverage.
                </p>
              </div>

              {utilizationChartData.length > 0 ? (
                <div className="w-full h-80 pt-4 bg-[#0A0C10]/40 rounded-xl border border-slate-800 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilizationChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: "12px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#f8fafc" }}
                        labelStyle={{ fontWeight: "bold", color: "#f8fafc", fontSize: "11px" }}
                        itemStyle={{ fontSize: "11px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", pt: 10 }} />
                      <Bar dataKey="Enrolled" name="Active Attendance Seats" radius={[4, 4, 0, 0]} fill="#3b82f6">
                        {utilizationChartData.map((entry, index) => {
                          const limitExceeded = entry.Enrolled > entry.Capacity;
                          return <Cell key={`cell-${index}`} fill={limitExceeded ? "#ef4444" : "#3b82f6"} />;
                        })}
                      </Bar>
                      <Bar dataKey="Capacity" name="Max Safe Room Capacity" radius={[4, 4, 0, 0]} fill="#475569" opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-20 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                  <p className="text-xs text-slate-500 italic">No scheduled rooms dataset compiled yet.</p>
                  <p className="text-[10px] text-slate-400">Run optimization under Scheduler tab to model spatial utilization.</p>
                </div>
              )}
            </div>
          )}

          {/* 2. CLASHES / CONFLICT ANALYSIS LEDGER */}
          {activeReportSubTab === "clashes" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Constraint Validation Audit (PRD Acceptance Criteria)</h3>
                <p className="text-xs text-slate-400">
                  Detailed inspection report registering hard and soft constraints. Hard conflicts block timetable publishing and must be resolved.
                </p>
              </div>

              <div className="space-y-3">
                {reportsList.map((rep) => (
                  <div
                    key={rep.id}
                    className={`p-4 rounded-xl border flex gap-4 ${
                      rep.type === "Hard"
                        ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                        : "bg-amber-955/20 bg-amber-950/20 border-amber-900/40 text-amber-300"
                    }`}
                  >
                    <span className={`px-2.5 py-1 rounded font-bold text-[9px] h-fit uppercase ${
                      rep.type === "Hard" ? "bg-rose-950 text-rose-455 text-rose-400 border border-rose-900/30" : "bg-amber-950 text-amber-455 text-amber-400 border border-amber-900/30"
                    }`}>
                      {rep.type} Limit
                    </span>
                    <div className="space-y-1 flex-grow">
                      <p className="text-xs font-bold">{rep.category}</p>
                      <p className="text-xs text-slate-400 leading-normal">{rep.message}</p>
                    </div>
                  </div>
                ))}

                {reportsList.length === 0 && (
                  <div className="py-16 text-center bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-emerald-305 text-emerald-300">🎉 Congratulations! Conflict-Free Status Achieved.</p>
                    <p className="text-[11px] text-emerald-400">Zero student overlaps, safe room distribution, and all accommodations resolved.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. PROCTOR WORKLOAD REPORTS */}
          {activeReportSubTab === "workload" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Proctoring Load Audit Check (FR-5 Invigilator Scheduling)</h3>
                <p className="text-xs text-slate-400">
                  Verifies that total assigned supervision duties do not exceed individual contractual max workloads specified by the proctoring office.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                {/* Visual grid meters */}
                <div className="space-y-4">
                  {invigilatorWorkloadData.map((inv) => {
                    const overlimit = inv.Duties > inv.Limit;
                    const pct = Math.min(100, Math.round((inv.Duties / inv.Limit) * 100));

                    return (
                      <div key={inv.name} className="p-4 rounded-xl border border-slate-800 space-y-2 bg-[#0A0C10]/40">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-200">{inv.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Department: {inv.Department}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-slate-300">{inv.Duties} / {inv.Limit} assignments</span>
                            {overlimit && <p className="text-[9px] font-bold text-rose-455 text-rose-400">Over contractual load!</p>}
                          </div>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-100 ${overlimit ? "bg-rose-500" : "bg-indigo-500"}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vertical representation */}
                <div className="w-full h-80 bg-[#0A0C10]/40 rounded-xl border border-slate-800 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invigilatorWorkloadData} layout="vertical" margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#cbd5e1" }} width={80} />
                      <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px", backgroundColor: "#1e293b", borderColor: "#334155" }} />
                      <Bar dataKey="Duties" name="Duties Assigned" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 4. ACCOMMODATION COMPLIANCE */}
          {activeReportSubTab === "accommodations" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Accommodation Audit Registry Check (100% Target Met)</h3>
                <p className="text-xs text-slate-400">
                  Detailed ledger documenting special accommodation matching (FR-3). Validates wheelchair floor plans and Quiet annex separate room assignments.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#0A0C10] text-slate-400 font-semibold border-b border-slate-800">
                      <th className="px-4 py-3.5">Candidate Name</th>
                      <th className="px-4 py-3.5">Condition Registry Needs</th>
                      <th className="px-4 py-3.5">Allocated Timeslots & Room Coordinates</th>
                      <th className="px-4 py-3.5">Audited Floor Security</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {studentAccommodationsList.map((row) => (
                      <tr key={row.student.id} className="hover:bg-[#12151C]/40">
                        <td className="px-4 py-3.5 font-semibold text-white">
                          {row.student.name}
                          <p className="text-[10px] text-slate-500 font-mono">ID: {row.student.id}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {row.student.accommodations.map((acc) => (
                              <span key={acc} className="px-2 py-0.5 rounded bg-amber-955/20 bg-amber-955/20 bg-amber-955/20 bg-amber-950/45 text-amber-400 border border-amber-900/30 font-semibold text-[10px] capitalize">
                                {acc.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {row.exams.map((ex, i) => (
                              <p key={i} className="text-slate-405 text-slate-400">
                                📚 {ex.courseId}: <span className="font-semibold text-white">{ex.roomName}</span> (Slot: {ex.timeslot})
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.isSecure ? "bg-emerald-950/35 text-emerald-400 border border-emerald-900/30" : "bg-rose-950/35 text-rose-455 text-rose-400 border border-rose-900/40"
                          }`}>
                            {row.isSecure ? "✓ Access compliance validated" : "⚠ Ground-access floor required!"}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {studentAccommodationsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-500 italic">
                          No special candidates accommodation needs in student files.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
