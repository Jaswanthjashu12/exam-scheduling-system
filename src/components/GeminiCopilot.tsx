/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry } from "../types";
import { evaluateSchedule, getConflictReport } from "../utils/solver";
import { Sparkles, Send, RefreshCw, AlertCircle, CheckCircle, BrainCircuit } from "lucide-react";

interface GeminiCopilotProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  invigilators: Invigilator[];
  entries: ScheduleEntry[];
}

export default function GeminiCopilot({ courses, rooms, students, invigilators, entries }: GeminiCopilotProps) {
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerAudit = async (customTopic?: string) => {
    setLoading(true);
    setError(null);
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
                disabled={loading}
                className="w-full text-left p-3 border border-slate-800 hover:border-indigo-555 hover:border-indigo-500 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                {topic}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => triggerAudit()}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition hover:brightness-110 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {loading ? "Analyzing..." : "Trigger Full Academic Audit"}
          </button>
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
          ) : feedback ? (
            <div className="space-y-3 leading-relaxed text-slate-200">
              {/* Parse headers into clean UI divs for extreme typography polish */}
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
