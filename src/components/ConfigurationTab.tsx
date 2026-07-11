/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Course, Room, Student, Invigilator, AccommodationType } from "../types";
import { getCourseEnrollment, getTimeslotExact, DEFAULT_TIMESLOTS } from "../utils/solver";
import { Plus, Trash, Edit2, GraduationCap, School, Users, Key, Briefcase, FileText, Check, AlertCircle, Info, Sparkles, X, Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface ConfigurationTabProps {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  invigilators: Invigilator[];
  setInvigilators: React.Dispatch<React.SetStateAction<Invigilator[]>>;
  branches: string[];
  setBranches: React.Dispatch<React.SetStateAction<string[]>>;
  collegeName: string;
  setCollegeName: (name: string) => void;
  onReset: () => void;
  onLoadSimple: () => void;
  onClearAll?: () => void;
  examStartDate?: string;
}

export default function ConfigurationTab({
  courses,
  setCourses,
  rooms,
  setRooms,
  students,
  setStudents,
  invigilators,
  setInvigilators,
  branches,
  setBranches,
  collegeName,
  setCollegeName,
  onReset,
  onLoadSimple,
  onClearAll,
  examStartDate = "2026-06-15",
}: ConfigurationTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"courses" | "rooms" | "students" | "invigilators">("courses");
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);
  const [llmTheme, setLlmTheme] = useState("Cybersecurity High School");
  const [llmError, setLlmError] = useState<string | null>(null);

  // Editing state variables
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingInvigId, setEditingInvigId] = useState<string | null>(null);

  // New course input state
  const [newCourseId, setNewCourseId] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDuration, setNewCourseDuration] = useState(120);
  const [newCoursePriority, setNewCoursePriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [newCourseBranch, setNewCourseBranch] = useState("");
  const [newCourseYear, setNewCourseYear] = useState<number>(1);
  const [courseFilterBranch, setCourseFilterBranch] = useState("all");
  const [courseFilterYear, setCourseFilterYear] = useState<string>("all");

  // New academic branch inputs
  const [newBranchInput, setNewBranchInput] = useState("");

  // New room input state
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState(30);
  const [newRoomBuilding, setNewRoomBuilding] = useState("Science Plaza");
  const [newRoomBlock, setNewRoomBlock] = useState("");
  const [newRoomAccessible, setNewRoomAccessible] = useState(true);

  // New student input state
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentYear, setNewStudentYear] = useState<number>(1);
  const [newStudentBranch, setNewStudentBranch] = useState("CSE");
  const [newStudentSection, setNewStudentSection] = useState("A");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedAccs, setSelectedAccs] = useState<AccommodationType[]>([]);
  const [studentFilterYear, setStudentFilterYear] = useState<string>("all");

  // New invigilator input status
  const [newInvigId, setNewInvigId] = useState("");
  const [newInvigName, setNewInvigName] = useState("");
  const [newInvigEmail, setNewInvigEmail] = useState("");
  const [newInvigDept, setNewInvigDept] = useState("");
  const [newInvigWorkload, setNewInvigWorkload] = useState(3);
  const [newInvigAvail, setNewInvigAvail] = useState<string[]>([
    "Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon"
  ]);

  // Excel Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<"courses" | "rooms" | "students" | "invigilators">("students");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; totalRows: number; errors: string[]; data?: any[] } | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);

  const openImportModal = (type: "courses" | "rooms" | "students" | "invigilators") => {
    setImportType(type);
    setImportMode("append");
    setImportFile(null);
    setImportResult(null);
    setImportModalOpen(true);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImportFile(file);
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
        setImportFile(file);
      }
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', importMode);
      const response = await fetch(`/api/import/${importType}`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed');
      setImportResult(result);

      // Refresh local state after successful import
      if (result.success && result.imported > 0) {
        const refreshRes = await fetch(`/api/${importType}`);
        const freshData = await refreshRes.json();
        switch (importType) {
          case 'students': setStudents(freshData); break;
          case 'invigilators': setInvigilators(freshData); break;
          case 'courses': setCourses(freshData); break;
          case 'rooms': setRooms(freshData); break;
        }
      }
    } catch (err: any) {
      setImportResult({ success: false, imported: 0, totalRows: 0, errors: [err.message || 'Import failed'] });
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = (type: string) => {
    window.open(`/api/import/template/${type}`, '_blank');
  };

  // Edit Helper handlers
  const handleEditCourseClick = (course: Course) => {
    setEditingCourseId(course.id);
    setNewCourseId(course.id);
    setNewCourseName(course.name);
    setNewCourseDuration(course.duration);
    setNewCoursePriority(course.priority);
    setNewCourseBranch(course.branch || "");
    setNewCourseYear(course.year || 1);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleCancelCourseEdit = () => {
    setEditingCourseId(null);
    setNewCourseId("");
    setNewCourseName("");
    setNewCourseBranch("");
    setNewCourseYear(1);
  };

  const handleEditRoomClick = (room: Room) => {
    setEditingRoomId(room.id);
    setNewRoomId(room.id);
    setNewRoomName(room.name);
    setNewRoomCapacity(room.capacity);
    setNewRoomBuilding(room.building);
    setNewRoomBlock(room.block || "");
    setNewRoomAccessible(room.accessible);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleCancelRoomEdit = () => {
    setEditingRoomId(null);
    setNewRoomId("");
    setNewRoomName("");
    setNewRoomBlock("");
  };

  const handleEditStudentClick = (student: Student) => {
    setEditingStudentId(student.id);
    setNewStudentId(student.id);
    setNewStudentName(student.name);
    setNewStudentEmail(student.email || "");
    setSelectedCourses(student.courses);
    setSelectedAccs(student.accommodations);
    setNewStudentYear(student.year || 1);
    setNewStudentBranch(student.branch || "CSE");
    setNewStudentSection(student.section || "A");
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleCancelStudentEdit = () => {
    setEditingStudentId(null);
    setNewStudentId("");
    setNewStudentName("");
    setNewStudentEmail("");
    setSelectedCourses([]);
    setSelectedAccs([]);
    setNewStudentYear(1);
    setNewStudentBranch("CSE");
    setNewStudentSection("A");
  };

  const handleEditInvigilatorClick = (invig: Invigilator) => {
    setEditingInvigId(invig.id);
    setNewInvigId(invig.id);
    setNewInvigName(invig.name);
    setNewInvigEmail(invig.email || "");
    setNewInvigDept(invig.department || "");
    setNewInvigWorkload(invig.maxWorkload);
    setNewInvigAvail(invig.availability);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleCancelInvigilatorEdit = () => {
    setEditingInvigId(null);
    setNewInvigId("");
    setNewInvigName("");
    setNewInvigEmail("");
    setNewInvigDept("");
  };

  const triggerGeminiMockGenerator = async () => {
    setIsLlmGenerating(true);
    setLlmError(null);
    try {
      const response = await fetch("/api/gemini/generate-mock-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: llmTheme }),
      });
      if (!response.ok) throw new Error("Failed to generate themed database.");
      const data = await response.json();
      
      if (data.courses && data.rooms && data.students && data.invigilators) {
        setCourses(data.courses);
        setRooms(data.rooms);
        setStudents(data.students);
        setInvigilators(data.invigilators);
      } else {
        throw new Error("Invalid structure returned from server.");
      }
    } catch (err: any) {
      setLlmError(err.message || "An error occurred with Gemini generator.");
    } finally {
      setIsLlmGenerating(false);
    }
  };

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId.trim() || !newCourseName.trim()) return;

    if (editingCourseId) {
      setCourses(courses.map((c) => c.id === editingCourseId ? {
        id: editingCourseId,
        name: newCourseName,
        duration: Number(newCourseDuration),
        priority: newCoursePriority,
        branch: newCourseBranch || branches[0] || "General Academic",
        year: Number(newCourseYear),
      } : c));
      setEditingCourseId(null);
      setNewCourseId("");
      setNewCourseName("");
      setNewCourseBranch("");
      setNewCourseYear(1);
    } else {
      if (courses.some((c) => c.id === newCourseId)) {
        alert("A course with this ID already exists.");
        return;
      }
      const course: Course = {
        id: newCourseId.toUpperCase(),
        name: newCourseName,
        duration: Number(newCourseDuration),
        priority: newCoursePriority,
        branch: newCourseBranch || branches[0] || "General Academic",
        year: Number(newCourseYear),
      };
      setCourses([...courses, course]);
      setNewCourseId("");
      setNewCourseName("");
      setNewCourseBranch("");
      setNewCourseYear(1);
    }
  };

  const handleDeleteCourse = (id: string) => {
    setCourses(courses.filter((c) => c.id !== id));
    if (editingCourseId === id) {
      setEditingCourseId(null);
      setNewCourseId("");
      setNewCourseName("");
      setNewCourseBranch("");
      setNewCourseYear(1);
    }
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim() || !newRoomName.trim()) return;

    if (editingRoomId) {
      setRooms(rooms.map((r) => r.id === editingRoomId ? {
        id: editingRoomId,
        name: newRoomName,
        capacity: Number(newRoomCapacity),
        building: newRoomBuilding,
        accessible: newRoomAccessible,
        block: newRoomBlock,
      } : r));
      setEditingRoomId(null);
      setNewRoomId("");
      setNewRoomName("");
      setNewRoomBlock("");
    } else {
      if (rooms.some((r) => r.id === newRoomId)) {
        alert("A room with this ID already exists.");
        return;
      }
      const room: Room = {
        id: newRoomId.toUpperCase(),
        name: newRoomName,
        capacity: Number(newRoomCapacity),
        building: newRoomBuilding,
        accessible: newRoomAccessible,
        block: newRoomBlock,
      };
      setRooms([...rooms, room]);
      setNewRoomId("");
      setNewRoomName("");
      setNewRoomBlock("");
    }
  };

  const handleDeleteRoom = (id: string) => {
    setRooms(rooms.filter((r) => r.id !== id));
    if (editingRoomId === id) {
      setEditingRoomId(null);
      setNewRoomId("");
      setNewRoomName("");
      setNewRoomBlock("");
    }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId.trim() || !newStudentName.trim() || selectedCourses.length === 0) return;

    if (editingStudentId) {
      setStudents(students.map((s) => s.id === editingStudentId ? {
        id: editingStudentId,
        name: newStudentName,
        email: newStudentEmail.trim() || undefined,
        courses: selectedCourses,
        accommodations: selectedAccs,
        year: Number(newStudentYear),
        branch: newStudentBranch,
        section: newStudentSection,
      } : s));
      setEditingStudentId(null);
      setNewStudentId("");
      setNewStudentName("");
      setNewStudentEmail("");
      setSelectedCourses([]);
      setSelectedAccs([]);
      setNewStudentYear(1);
      setNewStudentBranch("CSE");
      setNewStudentSection("A");
    } else {
      if (students.some((s) => s.id === newStudentId)) {
        alert("A student with this ID already exists.");
        return;
      }
      const student: Student = {
        id: newStudentId.toUpperCase(),
        name: newStudentName,
        email: newStudentEmail.trim() || undefined,
        courses: selectedCourses,
        accommodations: selectedAccs,
        year: Number(newStudentYear),
        branch: newStudentBranch,
        section: newStudentSection,
      };
      setStudents([...students, student]);
      setNewStudentId("");
      setNewStudentName("");
      setNewStudentEmail("");
      setSelectedCourses([]);
      setSelectedAccs([]);
      setNewStudentYear(1);
      setNewStudentBranch("CSE");
      setNewStudentSection("A");
    }
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
    if (editingStudentId === id) {
      setEditingStudentId(null);
      setNewStudentId("");
      setNewStudentName("");
      setNewStudentEmail("");
      setSelectedCourses([]);
      setSelectedAccs([]);
      setNewStudentYear(1);
      setNewStudentBranch("CSE");
      setNewStudentSection("A");
    }
  };

  const toggleStudentCourse = (courseId: string) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses(selectedCourses.filter((id) => id !== courseId));
    } else {
      setSelectedCourses([...selectedCourses, courseId]);
    }
  };

  const toggleStudentAcc = (acc: AccommodationType) => {
    if (selectedAccs.includes(acc)) {
      setSelectedAccs(selectedAccs.filter((a) => a !== acc));
    } else {
      setSelectedAccs([...selectedAccs, acc]);
    }
  };

  const handleAddInvigilator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvigId.trim() || !newInvigName.trim()) return;

    if (editingInvigId) {
      setInvigilators(invigilators.map((i) => i.id === editingInvigId ? {
        id: editingInvigId,
        name: newInvigName,
        email: newInvigEmail || undefined,
        department: newInvigDept,
        availability: newInvigAvail,
        maxWorkload: Number(newInvigWorkload),
      } : i));
      setEditingInvigId(null);
      setNewInvigId("");
      setNewInvigName("");
      setNewInvigEmail("");
      setNewInvigDept("");
    } else {
      if (invigilators.some((i) => i.id === newInvigId)) {
        alert("An invigilator with this ID already exists.");
        return;
      }
      const invig: Invigilator = {
        id: newInvigId.toUpperCase(),
        name: newInvigName,
        email: newInvigEmail || undefined,
        department: newInvigDept,
        availability: newInvigAvail,
        maxWorkload: Number(newInvigWorkload),
      };
      setInvigilators([...invigilators, invig]);
      setNewInvigId("");
      setNewInvigName("");
      setNewInvigEmail("");
      setNewInvigDept("");
    }
  };

  const handleDeleteInvigilator = (id: string) => {
    setInvigilators(invigilators.filter((i) => i.id !== id));
    if (editingInvigId === id) {
      setEditingInvigId(null);
      setNewInvigId("");
      setNewInvigName("");
      setNewInvigEmail("");
      setNewInvigDept("");
    }
  };

  return (
    <div className="space-y-6">
      {/* ========== IMPORT FROM EXCEL MODAL ========== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !importLoading && setImportModalOpen(false)}>
          <div className="bg-[#12151C] border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-cyan-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import {importType.charAt(0).toUpperCase() + importType.slice(1)} from Excel</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Upload .xlsx, .xls or .csv files</p>
                </div>
              </div>
              <button
                onClick={() => !importLoading && setImportModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Template Download */}
              <div className="flex items-center justify-between bg-[#0A0C10]/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs text-slate-300">Not sure about the format? Download the template first.</span>
                </div>
                <button
                  onClick={() => downloadTemplate(importType)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-[11px] font-semibold rounded-lg transition cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>

              {/* Import Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Import Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 justify-center ${
                      importMode === 'append'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-[#0A0C10] border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Append to Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 justify-center ${
                      importMode === 'replace'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-[#0A0C10] border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Replace All
                  </button>
                </div>
                {importMode === 'replace' && (
                  <p className="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Warning: This will delete all existing {importType} before importing.
                  </p>
                )}
              </div>

              {/* File Drop Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Select File</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={handleImportDrop}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    importDragOver
                      ? 'border-emerald-400 bg-emerald-500/5'
                      : importFile
                        ? 'border-emerald-500/30 bg-emerald-950/10'
                        : 'border-slate-700 bg-[#0A0C10]/40 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    id="excel-import-input"
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white">{importFile.name}</p>
                        <p className="text-[10px] text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImportFile(null); setImportResult(null); }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">Drag & drop your Excel file here</p>
                      <p className="text-[10px] text-slate-500 mt-1">or click to browse • .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className={`rounded-xl border p-4 space-y-2 ${
                  importResult.success && importResult.imported > 0
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {importResult.success && importResult.imported > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className={`text-xs font-bold ${
                      importResult.success && importResult.imported > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {importResult.success
                        ? `Successfully imported ${importResult.imported} of ${importResult.totalRows} rows`
                        : 'Import failed'}
                    </span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 mt-2">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-[10px] text-rose-400/80 flex items-start gap-1">
                          <span className="shrink-0">•</span> {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-[#0A0C10]/40">
              <button
                onClick={() => !importLoading && setImportModalOpen(false)}
                disabled={importLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {importResult?.success ? 'Close' : 'Cancel'}
              </button>
              {(!importResult?.success || importResult?.imported === 0) && (
                <button
                  onClick={handleImportSubmit}
                  disabled={!importFile || importLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/30"
                >
                  {importLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Import {importType.charAt(0).toUpperCase() + importType.slice(1)}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* College branding and Branch setup workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Branding config */}
        <div className="p-6 rounded-2xl bg-[#12151C] border border-slate-800 lg:col-span-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <School className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">My College Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">College / University Name</label>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Enter college or institution name"
                className="w-full px-3 py-2 text-xs border border-slate-705 border-slate-700 bg-[#0A0C10] text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
              <p className="text-[10px] text-slate-500 mt-2 font-light">
                Updates customized headers, scheduler dashboards, print layouts and report forms across all views in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Academic Branches configuration */}
        <div className="p-6 rounded-2xl bg-[#12151C] border border-slate-800 lg:col-span-7 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Academic branches ({branches.length})</h2>
            </div>
            <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded px-1.5 py-0.5 font-bold uppercase">Configure Majors</span>
          </div>

          <div className="space-y-4 col-span-2">
            {/* Branches tag-card collection */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-[#0A0C10]/40 rounded-xl border border-slate-800">
              {branches.map((bName) => (
                <div key={bName} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-805 bg-slate-800/60 border border-slate-700/60 text-slate-200 text-xs rounded-lg hover:border-slate-600 transition">
                  <span className="font-semibold text-[11px]">{bName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove the "${bName}" branch? Courses previously assigned this branch may need to be reclassified.`)) {
                        setBranches(branches.filter((x) => x !== bName));
                      }
                    }}
                    className="p-0.5 hover:bg-slate-700/80 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Remove branch"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {branches.length === 0 && (
                <div className="text-center py-4 w-full text-[10px] text-slate-500 font-medium">
                  Zero branches configured. Add your first academic branch below!
                </div>
              )}
            </div>

            {/* Inline addition form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newBranchInput.trim();
                if (!trimmed) return;
                if (branches.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
                  alert("This academic branch/major already exists.");
                  return;
                }
                setBranches([...branches, trimmed]);
                setNewBranchInput("");
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="e.g. Mechanical Engineering"
                value={newBranchInput}
                onChange={(e) => setNewBranchInput(e.target.value)}
                className="flex-grow px-3 py-2 text-xs border border-slate-700 bg-[#0A0C10] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Branch
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-[#12151C] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="flex border-b border-slate-800 bg-[#0A0C10]/40">
          <button
            onClick={() => setActiveSubTab("courses")}
            className={`flex-1 py-3.5 text-xs font-medium border-b-2 gap-2 flex items-center justify-center transition-all cursor-pointer ${
              activeSubTab === "courses"
                ? "border-blue-500 text-blue-400 bg-slate-800/20"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Courses ({courses.length})
          </button>
          <button
            onClick={() => setActiveSubTab("rooms")}
            className={`flex-1 py-3.5 text-xs font-medium border-b-2 gap-2 flex items-center justify-center transition-all cursor-pointer ${
              activeSubTab === "rooms"
                ? "border-blue-500 text-blue-400 bg-slate-800/20"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <School className="w-4 h-4" />
            Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setActiveSubTab("students")}
            className={`flex-1 py-3.5 text-xs font-medium border-b-2 gap-2 flex items-center justify-center transition-all cursor-pointer ${
              activeSubTab === "students"
                ? "border-blue-500 text-blue-400 bg-slate-800/20"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Students ({students.length})
          </button>
          <button
            onClick={() => setActiveSubTab("invigilators")}
            className={`flex-1 py-3.5 text-xs font-medium border-b-2 gap-2 flex items-center justify-center transition-all cursor-pointer ${
              activeSubTab === "invigilators"
                ? "border-blue-500 text-blue-400 bg-slate-800/20"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Invigilators ({invigilators.length})
          </button>
        </div>

        {/* Tab contents */}
        <div className="p-6">
          {/* 1. COURSES SUBTAB */}
          {activeSubTab === "courses" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form panel */}
              <form onSubmit={handleAddCourse} className="space-y-4 bg-[#0A0C10]/60 p-5 rounded-2xl border border-slate-800 h-fit">
                <h3 className="text-sm font-semibold text-white">{editingCourseId ? "Edit Course" : "Add New Course"}</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Course Code / ID</label>
                  <input
                    type="text"
                    required
                    disabled={editingCourseId !== null}
                    placeholder="e.g. CS-301"
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-550 ${
                      editingCourseId ? "opacity-50 cursor-not-allowed bg-slate-800" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Course Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Database Algorithms"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-550"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Academic Branch</label>
                  <select
                    value={newCourseBranch}
                    onChange={(e) => setNewCourseBranch(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="" className="bg-[#12151C] text-slate-400">-- Choose Branch / Department --</option>
                    {branches.map((b) => (
                      <option key={b} value={b} className="bg-[#12151C]">{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Academic Year</label>
                  <select
                    value={newCourseYear}
                    onChange={(e) => setNewCourseYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer font-medium"
                  >
                    <option value={1} className="bg-[#12151C]">Year 1 (Freshman)</option>
                    <option value={2} className="bg-[#12151C]">Year 2 (Sophomore)</option>
                    <option value={3} className="bg-[#12151C]">Year 3 (Junior)</option>
                    <option value={4} className="bg-[#12151C]">Year 4 (Senior)</option>
                  </select>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-805">
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm font-semibold"
                  >
                    {editingCourseId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingCourseId ? "Save Course Changes" : "Add Course"}
                  </button>
                  {editingCourseId && (
                    <button
                      type="button"
                      onClick={handleCancelCourseEdit}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer font-semibold"
                    >
                      <X className="w-4 h-4" /> Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Grid or Table list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3 className="text-xs font-semibold text-slate-404 text-slate-400 uppercase tracking-wider">Active Course Listings</h3>
                    <select
                      value={courseFilterBranch}
                      onChange={(e) => setCourseFilterBranch(e.target.value)}
                      className="px-2.5 py-1 bg-[#0A0C10] border border-slate-800 text-[11px] rounded-lg text-slate-300 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">📂 View All Branches</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <select
                      value={courseFilterYear}
                      onChange={(e) => setCourseFilterYear(e.target.value)}
                      className="px-2.5 py-1 bg-[#0A0C10] border border-slate-800 text-[11px] rounded-lg text-slate-300 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">📅 View All Years</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <button onClick={() => openImportModal('courses')} className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-semibold flex items-center gap-1 select-none bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition hover:bg-emerald-500/15">
                      <Upload className="w-3 h-3" /> Import Excel
                    </button>
                    <span className="text-slate-700">|</span>
                    <button onClick={onLoadSimple} className="text-blue-400 hover:underline cursor-pointer font-semibold flex items-center gap-1 select-none">
                      ✨ Load Simple Preset
                    </button>
                    <span className="text-slate-700">|</span>
                    <button onClick={onReset} className="text-emerald-450 text-emerald-400 hover:underline cursor-pointer font-semibold select-none">
                      🔄 Reset Mock
                    </button>
                    {onClearAll && (
                      <>
                        <span className="text-slate-700">|</span>
                        <button onClick={onClearAll} className="text-rose-400 hover:underline cursor-pointer font-bold select-none">
                          🧹 Clear All DB
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-slate-400 font-medium text-xs border-b border-slate-800">
                        <th className="px-4 py-3">Course Code</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Year</th>
                        <th className="px-4 py-3">Enrollments</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {(() => {
                        const filteredCourses = courses.filter((c) => {
                          const matchesBranch = courseFilterBranch === "all" || c.branch === courseFilterBranch;
                          const matchesYear = courseFilterYear === "all" || String(c.year || 1) === courseFilterYear;
                          return matchesBranch && matchesYear;
                        });

                        if (filteredCourses.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                No courses found matching the active filters. Change filter or add a course!
                              </td>
                            </tr>
                          );
                        }

                        return filteredCourses.map((course) => {
                          const enrolled = getCourseEnrollment(course.id, students).length;
                          return (
                            <tr key={course.id} className="hover:bg-slate-800/10">
                              <td className="px-4 py-2.5 font-mono font-semibold text-white">{course.id}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-200">{course.name}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-semibold">
                                  {course.branch || "General Academic"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 text-[10px] font-semibold">
                                  Year {course.year || 1}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-300 font-semibold">{enrolled} students</td>
                              <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1.5 h-[38px]">
                                <button
                                  type="button"
                                  onClick={() => handleEditCourseClick(course)}
                                  className="p-1 text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                                  title="Edit Course"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCourse(course.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                  title="Delete Course"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. ROOMS SUBTAB */}
          {activeSubTab === "rooms" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form panel */}
              <form onSubmit={handleAddRoom} className="space-y-4 bg-[#0A0C10]/60 p-5 rounded-2xl border border-slate-800 h-fit">
                <h3 className="text-sm font-semibold text-white">{editingRoomId ? "Edit Room" : "Add New Room"}</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Room ID</label>
                  <input
                    type="text"
                    required
                    disabled={editingRoomId !== null}
                    placeholder="e.g. ROOM-101"
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      editingRoomId ? "opacity-50 cursor-not-allowed bg-slate-800" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Room name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Turing Auditorium"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Capacity</label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={150}
                      value={newRoomCapacity}
                      onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Building Location</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Science Quad"
                      value={newRoomBuilding}
                      onChange={(e) => setNewRoomBuilding(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Block Number</label>
                    <select
                      value={newRoomBlock}
                      onChange={(e) => setNewRoomBlock(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">No Block</option>
                      <option value="Block 1">Block 1</option>
                      <option value="Block 2">Block 2</option>
                      <option value="Block 3">Block 3</option>
                      <option value="Block 4">Block 4</option>
                      <option value="Block 5">Block 5</option>
                      <option value="Block 6">Block 6</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  <input
                    type="checkbox"
                    id="roomAccessible"
                    checked={newRoomAccessible}
                    onChange={(e) => setNewRoomAccessible(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-550 h-4 w-4"
                  />
                  <label htmlFor="roomAccessible" className="text-xs font-medium text-slate-400 cursor-pointer">
                    ♿ Ground / Wheelchair Accessible
                  </label>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-805">
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm font-semibold"
                  >
                    {editingRoomId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingRoomId ? "Save Room Changes" : "Add Room"}
                  </button>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={handleCancelRoomEdit}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer font-semibold"
                    >
                      <X className="w-4 h-4" /> Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Grid or Table list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-slate-404 text-slate-400">Active Examination Rooms</h3>
                  <button onClick={() => openImportModal('rooms')} className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-semibold flex items-center gap-1 select-none bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition hover:bg-emerald-500/15 text-[11px]">
                    <Upload className="w-3 h-3" /> Import Excel
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-slate-400 font-medium text-xs border-b border-slate-800">
                        <th className="px-4 py-3">Room Code</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Capacity limit</th>
                        <th className="px-4 py-3">Building</th>
                        <th className="px-4 py-3">Block</th>
                        <th className="px-4 py-3">Accessibility</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {rooms.map((room) => (
                        <tr key={room.id} className="hover:bg-slate-800/10">
                          <td className="px-4 py-2.5 font-mono font-semibold text-white">{room.id}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-200">{room.name}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-400">{room.capacity} seats</td>
                          <td className="px-4 py-2.5 text-slate-400">{room.building}</td>
                          <td className="px-4 py-2.5 text-slate-400 font-semibold">{room.block || "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              room.accessible ? "bg-emerald-950/40 border border-emerald-900/30 text-emerald-400" : "bg-slate-900 text-slate-500"
                            }`}>
                              {room.accessible ? "♿ Accessible" : "Not Acc."}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1.5 h-[38px]">
                            <button
                              onClick={() => handleEditRoomClick(room)}
                              className="p-1 text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                              title="Edit Room"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoom(room.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Delete Room"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. STUDENTS SUBTAB */}
          {activeSubTab === "students" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <form onSubmit={handleAddStudent} className="space-y-4 bg-[#0A0C10]/60 p-5 rounded-2xl border border-slate-800 h-fit">
                <h3 className="text-sm font-semibold text-white">{editingStudentId ? "Edit Student" : "Add New Student"}</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Student ID</label>
                  <input
                    type="text"
                    required
                    disabled={editingStudentId !== null}
                    placeholder="e.g. STU-491"
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      editingStudentId ? "opacity-50 cursor-not-allowed bg-slate-800" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address <span className="text-slate-600">(optional)</span></label>
                  <input
                    type="email"
                    placeholder="e.g. john.doe@college.edu"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Academic Year</label>
                  <select
                    value={newStudentYear}
                    onChange={(e) => {
                      const newYear = Number(e.target.value);
                      setNewStudentYear(newYear);
                      // Filter selectedCourses to only keep courses belonging to the new year
                      const newYearCourseIds = courses.filter(c => (c.year || 1) === newYear).map(c => c.id);
                      setSelectedCourses(prev => prev.filter(id => newYearCourseIds.includes(id)));
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer font-medium"
                  >
                    <option value={1} className="bg-[#12151C]">Year 1 (Freshman)</option>
                    <option value={2} className="bg-[#12151C]">Year 2 (Sophomore)</option>
                    <option value={3} className="bg-[#12151C]">Year 3 (Junior)</option>
                    <option value={4} className="bg-[#12151C]">Year 4 (Senior)</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch</label>
                    <select
                      value={newStudentBranch}
                      onChange={(e) => setNewStudentBranch(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="CSE" className="bg-[#12151C]">CSE</option>
                      <option value="ECE" className="bg-[#12151C]">ECE</option>
                      <option value="EEE" className="bg-[#12151C]">EEE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Section</label>
                    <select
                      value={newStudentSection}
                      onChange={(e) => setNewStudentSection(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="A" className="bg-[#12151C]">Section A</option>
                      <option value="B" className="bg-[#12151C]">Section B</option>
                      <option value="C" className="bg-[#12151C]">Section C</option>
                      <option value="D" className="bg-[#12151C]">Section D</option>
                    </select>
                  </div>
                </div>
                
                {/* Course select list */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Enrolled Courses (Select at least 1)</label>
                  <div className="max-h-48 overflow-y-auto border border-slate-805 rounded-lg p-2.5 space-y-3 bg-[#12151C]">
                    {(() => {
                      const yearCourses = courses.filter(c => (c.year || 1) === newStudentYear);
                      const grouped = yearCourses.reduce((acc, c) => {
                        const branch = c.branch || "General / Uncategorized";
                        if (!acc[branch]) acc[branch] = [];
                        acc[branch].push(c);
                        return acc;
                      }, {} as Record<string, typeof courses>);
                      
                      const entries = Object.entries(grouped);
                      if (entries.length === 0) {
                        return (
                          <div className="text-center text-slate-500 py-6 text-xs italic">
                            No courses found for Year {newStudentYear}
                          </div>
                        );
                      }
                      
                      return entries.map(([branch, branchCourses]) => (
                        <div key={branch} className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 mb-1.5 flex justify-between items-center">
                            {branch}
                            <button
                              type="button"
                              onClick={() => {
                                const allSelected = branchCourses.every(c => selectedCourses.includes(c.id));
                                if (allSelected) {
                                  // Deselect all in this branch
                                  setSelectedCourses(selectedCourses.filter(id => !branchCourses.some(c => c.id === id)));
                                } else {
                                  // Select all in this branch
                                  const newSelection = [...selectedCourses];
                                  branchCourses.forEach(c => {
                                    if (!newSelection.includes(c.id)) newSelection.push(c.id);
                                  });
                                  setSelectedCourses(newSelection);
                                }
                              }}
                              className="text-[9px] text-blue-400 hover:text-blue-300 cursor-pointer capitalize font-semibold bg-blue-900/20 px-1.5 py-0.5 rounded"
                            >
                              {branchCourses.every(c => selectedCourses.includes(c.id)) ? "Deselect All" : "Select All"}
                            </button>
                          </div>
                          {branchCourses.map((course) => (
                            <label key={course.id} className="flex items-center gap-2 cursor-pointer text-xs ml-1 hover:bg-slate-800/40 p-1 rounded transition">
                              <input
                                type="checkbox"
                                checked={selectedCourses.includes(course.id)}
                                onChange={() => toggleStudentCourse(course.id)}
                                className="rounded border-slate-700 bg-slate-900 text-blue-550 focus:ring-blue-550 h-3.5 w-3.5 shrink-0"
                              />
                              <span className="font-mono font-semibold text-white shrink-0">{course.id}</span>
                              <span className="text-slate-400 truncate">- {course.name}</span>
                            </label>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Accommodation checkboxes */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Special Accommodations</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "extra_time", label: "⏱️ Extra Time" },
                      { key: "separate_room", label: "🤫 Quiet Space" },
                      { key: "accessible", label: "♿ Wheelchair" },
                      { key: "scribe", label: "✍️ Scribe Spt" },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-1.5 cursor-pointer text-[11px] p-1.5 border border-slate-800 hover:border-slate-700 rounded bg-[#12151C] text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedAccs.includes(item.key as any)}
                          onChange={() => toggleStudentAcc(item.key as any)}
                          className="rounded border-slate-705 bg-slate-900 text-blue-550 focus:ring-blue-550 h-3.5 w-3.5 mr-1"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-805">
                  <button
                    type="submit"
                    disabled={selectedCourses.length === 0}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-center"
                  >
                    {editingStudentId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingStudentId ? "Save Student Changes" : "Add Student"}
                  </button>
                  {editingStudentId && (
                    <button
                      type="button"
                      onClick={handleCancelStudentEdit}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer font-semibold"
                    >
                      <X className="w-4 h-4" /> Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Grid or Table list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-medium text-slate-404 text-slate-400">Active Enrolled Students</h3>
                    <select
                      value={studentFilterYear}
                      onChange={(e) => setStudentFilterYear(e.target.value)}
                      className="px-2.5 py-1 bg-[#0A0C10] border border-slate-800 text-[11px] rounded-lg text-slate-300 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">📅 View All Years</option>
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                  </div>
                  <button onClick={() => openImportModal('students')} className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-semibold flex items-center gap-1 select-none bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition hover:bg-emerald-500/15 text-[11px]">
                    <Upload className="w-3 h-3" /> Import Excel
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-slate-400 font-medium text-xs border-b border-slate-800">
                        <th className="px-4 py-3">Student ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Year</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Enrolled Exam Classes</th>
                        <th className="px-4 py-3">Special Accommodations</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {(() => {
                        const filteredStudents = studentFilterYear === "all"
                          ? students
                          : students.filter((s) => String(s.year || 1) === studentFilterYear);

                        if (filteredStudents.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                No students found matching the selected filters.
                              </td>
                            </tr>
                          );
                        }

                        return filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-800/10">
                            <td className="px-4 py-2.5 font-mono font-semibold text-white">{student.id}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-200">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-200">{student.name}</span>
                                {student.email && (
                                  <a href={`mailto:${student.email}`} className="text-[10px] text-slate-500 hover:text-blue-400 transition truncate max-w-[200px]">
                                    {student.email}
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 text-[10px] font-semibold">
                                Year {student.year || 1}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] font-semibold uppercase">
                                {student.branch || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/30 text-[10px] font-semibold uppercase">
                                Section {student.section || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              <div className="flex flex-wrap gap-1">
                                {student.courses.map((c) => (
                                  <span key={c} className="px-2 py-0.5 rounded bg-slate-850 border border-slate-800 text-slate-300 font-mono text-[10px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {student.accommodations.map((acc) => (
                                <span key={acc} className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/30 text-amber-400 font-semibold text-[10px]">
                                  {acc === "extra_time" ? "⏱️ Extra Time" :
                                   acc === "separate_room" ? "🤫 Separate Rm" :
                                   acc === "accessible" ? "♿ Wheelchair" : "✍️ Scribe"}
                                </span>
                              ))}
                              {student.accommodations.length === 0 && (
                                <span className="text-slate-500 italic text-[11px]">None required</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1.5 h-[38px]">
                            <button
                              onClick={() => handleEditStudentClick(student)}
                              className="p-1 text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                              title="Edit Student"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. INVIGILATORS SUBTAB */}
          {activeSubTab === "invigilators" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form panel */}
              <form onSubmit={handleAddInvigilator} className="space-y-4 bg-[#0A0C10]/60 p-5 rounded-2xl border border-slate-800 h-fit">
                <h3 className="text-sm font-semibold text-white">{editingInvigId ? "Edit Proctor" : "Add New Proctor"}</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Invigilator ID</label>
                  <input
                    type="text"
                    required
                    disabled={editingInvigId !== null}
                    placeholder="e.g. INV-10"
                    value={newInvigId}
                    onChange={(e) => setNewInvigId(e.target.value)}
                    className={`w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      editingInvigId ? "opacity-50 cursor-not-allowed bg-slate-800" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alan Turing"
                    value={newInvigName}
                    onChange={(e) => setNewInvigName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. turing@college.edu"
                    value={newInvigEmail}
                    onChange={(e) => setNewInvigEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Department</label>
                    <select
                      value={newInvigDept}
                      onChange={(e) => setNewInvigDept(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-200 rounded-lg focus:outline-none cursor-pointer"
                    >
                      <option value="" className="bg-[#12151C] text-slate-400">General Branch</option>
                      {branches.map((b) => (
                        <option key={b} value={b} className="bg-[#12151C]">{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Duties Count</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      value={newInvigWorkload}
                      onChange={(e) => setNewInvigWorkload(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-700 bg-[#12151C] text-slate-350 rounded-lg focus:outline-none bg-[#12151C] text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Availability Sessions</label>
                  <div className="grid grid-cols-1 gap-1 text-[11px] max-h-32 overflow-y-auto p-2 border border-slate-800 rounded-lg bg-[#12151C] text-slate-300">
                    {DEFAULT_TIMESLOTS.map((ts) => (
                      <label key={ts.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newInvigAvail.includes(ts.id)}
                          onChange={() => {
                            if (newInvigAvail.includes(ts.id)) {
                              setNewInvigAvail(newInvigAvail.filter((s) => s !== ts.id));
                            } else {
                              setNewInvigAvail([...newInvigAvail, ts.id]);
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-550 h-3.5 w-3.5"
                        />
                        <span className="font-medium text-slate-300">{getTimeslotExact(ts.id, examStartDate)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-805">
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm font-semibold"
                  >
                    {editingInvigId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingInvigId ? "Save Proctor Changes" : "Add Invigilator"}
                  </button>
                  {editingInvigId && (
                    <button
                      type="button"
                      onClick={handleCancelInvigilatorEdit}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer font-semibold"
                    >
                      <X className="w-4 h-4" /> Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Grid or Table list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-slate-404 text-slate-400">Active Invigilators (Proctors)</h3>
                  <button onClick={() => openImportModal('invigilators')} className="text-emerald-400 hover:text-emerald-300 cursor-pointer font-semibold flex items-center gap-1 select-none bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition hover:bg-emerald-500/15 text-[11px]">
                    <Upload className="w-3 h-3" /> Import Excel
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0A0C10] text-slate-400 font-medium text-xs border-b border-slate-800">
                        <th className="px-4 py-3">Proctor ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Max Workload limit</th>
                        <th className="px-4 py-3">Availability slots</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {invigilators.map((invig) => (
                        <tr key={invig.id} className="hover:bg-slate-800/10">
                          <td className="px-4 py-2.5 font-mono font-semibold text-white">{invig.id}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-200">
                            <div>{invig.name}</div>
                            {invig.email && <div className="text-[10px] text-slate-500 font-normal mt-0.5">{invig.email}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{invig.department}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-300">{invig.maxWorkload} assignments</td>
                          <td className="px-4 py-2.5 max-w-xs truncate text-[11px]" title={invig.availability.map((av) => getTimeslotExact(av, examStartDate)).join(", ")}>
                            <div className="flex flex-wrap gap-1">
                              {invig.availability.map((av) => (
                                <span key={av} className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-900/60 text-sky-400 text-[9px] font-medium">
                                  {getTimeslotExact(av, examStartDate)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1.5 h-[38px]">
                            <button
                              onClick={() => handleEditInvigilatorClick(invig)}
                              className="p-1 text-slate-400 hover:text-indigo-400 transition cursor-pointer"
                              title="Edit Proctor"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvigilator(invig.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              title="Delete Proctor"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
