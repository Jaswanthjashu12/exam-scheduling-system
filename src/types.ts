/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Course {
  id: string;
  name: string;
  duration: number; // in minutes
  priority: "High" | "Medium" | "Low";
  branch?: string; // Academic branch/department of study
  year?: number; // Academic year (1, 2, 3, or 4)
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  courses: string[]; // Course IDs
  accommodations: AccommodationType[];
  year?: number; // Academic year (1, 2, 3, or 4)
}

export type AccommodationType = 
  | "extra_time"     // 25% extra time
  | "separate_room"  // Needs non-crowded room
  | "accessible"     // Wheelchair/ground access
  | "scribe";        // Scribe/reader support

export interface Room {
  id: string;
  name: string;
  capacity: number;
  building: string;
  accessible: boolean;
}

export interface Invigilator {
  id: string;
  name: string;
  email?: string;
  department: string;
  availability: string[]; // Array of slot IDs (e.g., "Day-1-Morning")
  maxWorkload: number; // Max total assignments across the exam period
}

export type SlotPeriod = "Morning" | "Afternoon" | "Evening";

export interface Timeslot {
  id: string; // e.g. "Day-1-Morning"
  day: number; // 1, 2, 3...
  period: SlotPeriod;
  timeLabel: string; // e.g. "09:00 - 11:00"
}

export interface ScheduleEntry {
  id: string; // Unique assignment ID
  courseId: string;
  timeslotId: string;
  roomId: string;
  invigilatorId: string;
}

export interface SeatingPosition {
  row: number;
  col: number;
  studentId: string | null;
  accommodationType?: AccommodationType[];
  cheatingWarning?: boolean;
}

export interface ConstraintWeights {
  studentConflict: number;   // Hard constraint: student back-to-back or overlap
  roomCapacity: number;      // Hard constraint: students exceeding room capacity
  accommodationMatch: number; // Hard constraint: room matches student needs
  invigilatorOverlap: number; // Hard constraint: invigilator assigned to 2 rooms in same slot
  travelTime: number;        // Soft constraint: back-to-back exams across distinct buildings
  roomUtilization: number;   // Soft constraint: small exams wasting big halls
  invigilatorWorkload: number; // Soft constraint: invigilator workload balance
  cheatingSeparation: number; // Soft/Hard: adjacent seating of high-risk students
  strictBranchSeparation?: boolean; // If true, only 1 branch per room is allowed. If false/undefined, max 3.
}

export interface ConflictReport {
  id: string;
  type: "Hard" | "Soft";
  category: "Student Overlap" | "Room Overflow" | "Accommodation Mismatch" | "Invigilator Clash" | "Travel Conflict" | "Cheating Risk" | "Invigilator Workload";
  message: string;
  impactScore: number;
}

export interface EvaluationMetrics {
  totalCost: number;
  conflictPenalty: number;
  travelPenalty: number;
  roomWaste: number;
  invigilatorOverload: number;
  cheatingRiskScore: number;
  
  // High-level statistics
  studentConflictCount: number;
  roomCapacityViolations: number;
  accommodationMismatches: number;
  invigilatorOverlapCount: number;
  travelViolationCount: number;
  compliancePercentage: number; // 0-100%
  averageRoomUtilization: number; // Percentage
  unassignedExams: number;
}
