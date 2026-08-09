/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry } from "../types";
import { evaluateSchedule, getConflictReport } from "../utils/solver";
import { Sparkles, RefreshCw, AlertCircle, CheckCircle, BrainCircuit, Wrench, XCircle, Info } from "lucide-react";
import { getAutoFixProposal, applyAutoFixProposal } from "../api/client";

interface GeminiCopilotProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  invigilators: Invigilator[];
  entries: ScheduleEntry[];
  onScheduleUpdate?: (newEntries: ScheduleEntry[]) => void;
}

export default function GeminiCopilot({ courses, rooms, students, invigilators, entries, onScheduleUpdate }: GeminiCopilotProps) {
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-stage Auto-Fix states
  const [stepStatus, setStepStatus] = useState<"idle" | "detecting" | "generating" | "validating" | "ready" | "applying" | "error">("idle");
  const [proposal, setProposal] = useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [originalConflictsCount, setOriginalConflictsCount] = useState(0);
  const [newConflictsCount, setNewConflictsCount] = useState(0);

  const triggerAudit = async (customTopic?: string) => {
    setLoading(true);
    setError(null);
    setFeedback("");
    setProposal(null);
    setStepStatus("idle");
    try {
      const stats = evaluateSchedule(entries, courses, students, rooms, invigilators);
      const conflicts = getConflictReport(entries, courses, students, rooms, invigilators);

      const response = await fetch("/api/gemini/optimize-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: entries,
          conflicts: conflicts.map((c) => ({ category: c.category, message: c.message })),
          stats: {
            roomUtilization: stats.averageRoomUtilization,
            accommodationCompliance: stats.compliancePercentage,
            unassignedInvigilators: invigilators.length - new Set(entries.map((e) => e.invigilatorId)).size,
          },
          topic: customTopic || "General Timetable Audit"
        }),
      });

      if (!response.ok) throw new Error("Connection failed to Gemini scheduling proxy.");
      const data = await response.json();
      setFeedback(data.feedback);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching AI audit reports.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFixStart = async () => {
    setStepStatus("detecting");
    setError(null);
    setProposal(null);
    setValidationErrors([]);
    setFeedback("");

    try {
      const conflicts = getConflictReport(entries, courses, students, rooms, invigilators);
      if (conflicts.length === 0) {
        setStepStatus("idle");
        alert("🎉 No active conflicts found! The schedule is already optimal.");
        return;
      }

      setStepStatus("generating");
      const res = await getAutoFixProposal();
      
      setStepStatus("validating");
      if (!res.success) {
        setStepStatus("error");
        setValidationErrors(res.errors || ["Failed to validate AI proposal."]);
        return;
      }

      setProposal(res.proposal.modifications);
      setOriginalConflictsCount(res.conflicts.length);
      setNewConflictsCount(res.remainingConflicts.length);
      setStepStatus("ready");

      if (res.message) {
        setFeedback(`### ⚠️ Fallback Mode Note\n\n${res.message}`);
      }
    } catch (err: any) {
      setStepStatus("error");
      setValidationErrors([err.message || "An error occurred during AI auto-fix optimization."]);
    }
  };

  const handleApplyFix = async () => {
    if (!proposal) return;
    setStepStatus("applying");
    try {
      const res = await applyAutoFixProposal(proposal);
      if (res.success && res.entries) {
        if (onScheduleUpdate) {
          onScheduleUpdate(res.entries);
        }
        setStepStatus("idle");
        setProposal(null);
        alert(res.message || "AI Auto-Fix applied successfully and committed to database!");
      } else {
        setStepStatus("error");
        setValidationErrors(["Failed to apply the AI fix. Please reload and try again."]);
      }
    } catch (err: any) {
      setStepStatus("error");
      setValidationErrors([err.message || "An error occurred applying the AI fix."]);
    }
  };

  const handleRejectFix = () => {
    setProposal(null);
    setStepStatus("idle");
    setValidationErrors([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Topics / Helpers panel */}
      <div className="space-y-4">
        <div className="bg-[#12151C] p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Consult Copilot</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Select an assessment macro. Gemini will consume the dynamic entries, compile accommodation checks and proctoring schedules, and output recommendations.
          </p>

          <div className="space-y-2.5 pt-2">
            {[
              "Review Proctor Workloads",
              "Scan Accommodation Roadblocks",
              "Audit Cheating & Proximity Risks",
              "Check Building Travel Buffers"
            ].map((topic) => (
              <button
                key={topic}
                onClick={() => triggerAudit(topic)}
                disabled={loading || stepStatus !== "idle"}
                className="w-full text-left p-3 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                {topic}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => triggerAudit()}
            disabled={loading || stepStatus !== "idle"}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition hover:brightness-110 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {loading ? "Analyzing..." : "Trigger Full Academic Audit"}
          </button>

          <button
            onClick={handleAutoFixStart}
            disabled={loading || stepStatus !== "idle"}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition hover:brightness-110 shadow-sm disabled:opacity-50"
          >
            <Wrench className="w-3.5 h-3.5" />
            {stepStatus !== "idle" ? "Processing..." : "Auto-Fix Conflicts with AI"}
          </button>

          {/* Validation Checklist / Steps */}
          {stepStatus !== "idle" && (
            <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-2.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Auto-Fix Steps</span>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  {stepStatus === "detecting" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span className={stepStatus === "detecting" ? "text-indigo-400 font-bold" : "text-slate-400"}>
                    Detecting conflicts...
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {stepStatus === "detecting" ? (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />
                  ) : stepStatus === "generating" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : stepStatus === "error" && validationErrors.length > 0 ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span className={stepStatus === "generating" ? "text-amber-400 font-bold" : "text-slate-400"}>
                    Generating AI solution...
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {stepStatus === "detecting" || stepStatus === "generating" ? (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />
                  ) : stepStatus === "validating" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                  ) : stepStatus === "error" && validationErrors.length > 0 ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span className={stepStatus === "validating" ? "text-teal-400 font-bold" : "text-slate-400"}>
                    Validating AI proposal...
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {stepStatus === "ready" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : stepStatus === "applying" ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  ) : stepStatus === "error" && validationErrors.length > 0 ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />
                  )}
                  <span className={stepStatus === "ready" || stepStatus === "applying" ? "text-emerald-400 font-bold" : "text-slate-400"}>
                    {stepStatus === "applying" ? "Applying changes..." : "Proposal validated"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-950/20 text-red-400 border border-red-900/40 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Audit Feedback Output canvas */}
      <div className="lg:col-span-2 bg-[#12151C] p-6 rounded-2xl border border-slate-800 space-y-4 font-normal">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Audit Output Terminal</h3>
        
        <div className="min-h-[350px] p-5 bg-[#0A0C10] text-slate-100 rounded-2xl font-sans text-xs border border-slate-800 space-y-4 overflow-y-auto max-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-[11px] text-slate-400 font-medium">Gemini is auditing live schedule matrices...</p>
            </div>
          ) : stepStatus === "ready" && proposal ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-emerald-400">🤖 Gemini AI Auto-Fix Proposal</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">The proposal has been successfully validated against current database constraints.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-2.5 py-0.5 rounded-full">
                    Ready to Apply
                  </span>
                </div>
              </div>

              {feedback && (
                <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                  {feedback.replace("### ⚠️ Fallback Mode Note", "").trim()}
                </div>
              )}

              <div className="space-y-2">
                <h5 className="text-[11px] font-semibold text-slate-400">AI Proposed Changes ({proposal.length})</h5>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {proposal.length === 0 ? (
                    <div className="p-3 bg-slate-900/40 text-slate-400 text-center rounded-xl">
                      No changes required to resolve conflicts.
                    </div>
                  ) : (
                    proposal.map((mod, index) => {
                      const entry = entries.find(e => e.id === mod.entryId);
                      const course = courses.find(c => c.id === entry?.courseId);
                      
                      const oldRoom = rooms.find(r => r.id === entry?.roomId)?.name || entry?.roomId || "Unassigned";
                      const newRoom = rooms.find(r => r.id === mod.roomId)?.name || mod.roomId || oldRoom;
                      const oldInvig = invigilators.find(i => i.id === entry?.invigilatorId)?.name || entry?.invigilatorId || "Unassigned";
                      const newInvig = invigilators.find(i => i.id === mod.invigilatorId)?.name || mod.invigilatorId || oldInvig;

                      return (
                        <div key={index} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-1.5 hover:border-slate-700 transition">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 text-xs">{course?.id}: {course?.name}</span>
                            <span className="text-[10px] text-slate-400">ID: {mod.entryId}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-500 block">Timeslot</span>
                              <span className="text-slate-300 font-semibold">{entry?.timeslotId} → {mod.timeslotId || entry?.timeslotId}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Room</span>
                              <span className="text-slate-300 font-semibold">{oldRoom} → {newRoom}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Proctor</span>
                              <span className="text-slate-300 font-semibold truncate block" title={newInvig}>{oldInvig} → {newInvig}</span>
                            </div>
                          </div>
                          {mod.reason && (
                            <p className="text-[10px] text-indigo-400 italic">💡 Reason: {mod.reason}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-center">
                <div className="p-2 bg-indigo-950/20 border border-indigo-900/30 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Conflicts Resolved</span>
                  <span className="text-lg font-bold text-indigo-400">{originalConflictsCount - newConflictsCount}</span>
                </div>
                <div className="p-2 bg-teal-950/20 border border-teal-900/30 rounded-xl">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">Remaining Conflicts</span>
                  <span className="text-lg font-bold text-teal-400">{newConflictsCount}</span>
                </div>
              </div>

              {newConflictsCount > 0 && (
                <div className="bg-yellow-950/10 border border-yellow-900/30 p-3 rounded-xl text-yellow-400 text-[10px]">
                  ⚠️ <strong>Partial Resolution:</strong> The AI solved as many conflicts as possible. {newConflictsCount} soft or minor conflict(s) remain. No unsafe changes have been automatically applied.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleRejectFix}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition"
                >
                  Reject Proposal
                </button>
                <button
                  onClick={handleApplyFix}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition"
                >
                  Apply AI Fix
                </button>
              </div>
            </div>
          ) : stepStatus === "error" && validationErrors.length > 0 ? (
            <div className="space-y-4 py-6 text-center max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-950/30 border border-red-900/40 text-red-400">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-red-400">❌ AI Proposal Rejected</h4>
                <p className="text-[10px] text-slate-400">The generated scheduling corrections failed validation against the live system rule schema.</p>
              </div>
              <div className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl text-left text-[10px] text-red-300 space-y-1 max-h-[150px] overflow-y-auto font-mono">
                {validationErrors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">No database changes were committed to SQLite.</p>
              <button
                onClick={handleRejectFix}
                className="mt-2 px-4 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition border border-slate-850"
              >
                Dismiss & Reset
              </button>
            </div>
          ) : feedback ? (
            <div className="space-y-3 leading-relaxed text-slate-200">
              {feedback.split("\n\n").map((para, i) => {
                if (para.trim().startsWith("###")) {
                  return (
                    <h4 key={i} className="text-sm font-bold text-indigo-400 pt-3 border-t border-slate-800/80 first:border-none first:pt-0">
                      {para.replace("###", "").trim()}
                    </h4>
                  );
                } else if (para.trim().startsWith("##") || para.trim().startsWith("#")) {
                  return (
                    <h4 key={i} className="text-sm font-extrabold text-blue-400 pt-3">
                      {para.replace(/#/g, "").trim()}
                    </h4>
                  );
                } else if (para.trim().startsWith("-") || para.trim().startsWith("*")) {
                  return (
                    <ul key={i} className="list-disc pl-5 space-y-1.5 text-slate-300">
                      {para.split("\n").map((li, j) => (
                        <li key={j}>{li.replace(/^[\s-*]+/, "").trim()}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={i}>{para}</p>;
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 text-slate-400">
              <BrainCircuit className="w-10 h-10 text-slate-500" />
              <div className="space-y-1 max-w-xs">
                <p className="font-semibold text-[11px]">System Idle</p>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Press "Trigger Full Academic Audit" or select a macro topic on the left sidebar terminal.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
