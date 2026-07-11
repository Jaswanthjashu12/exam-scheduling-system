/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Course,
  Student,
  Room,
  Invigilator,
  Timeslot,
  ScheduleEntry,
  ConstraintWeights,
  EvaluationMetrics,
  ConflictReport,
  SlotPeriod
} from "../types";

// Standard timeslot configs (Day 1-10, 3 slots per day)
export const DEFAULT_TIMESLOTS: Timeslot[] = [
  { id: "Day-1-Morning", day: 1, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-1-Afternoon", day: 1, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-1-Evening", day: 1, period: "Evening", timeLabel: "16:30 - 18:30" },
  
  { id: "Day-2-Morning", day: 2, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-2-Afternoon", day: 2, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-2-Evening", day: 2, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-3-Morning", day: 3, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-3-Afternoon", day: 3, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-3-Evening", day: 3, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-4-Morning", day: 4, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-4-Afternoon", day: 4, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-4-Evening", day: 4, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-5-Morning", day: 5, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-5-Afternoon", day: 5, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-5-Evening", day: 5, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-6-Morning", day: 6, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-6-Afternoon", day: 6, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-6-Evening", day: 6, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-7-Morning", day: 7, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-7-Afternoon", day: 7, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-7-Evening", day: 7, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-8-Morning", day: 8, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-8-Afternoon", day: 8, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-8-Evening", day: 8, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-9-Morning", day: 9, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-9-Afternoon", day: 9, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-9-Evening", day: 9, period: "Evening", timeLabel: "16:30 - 18:30" },

  { id: "Day-10-Morning", day: 10, period: "Morning", timeLabel: "09:00 - 11:00" },
  { id: "Day-10-Afternoon", day: 10, period: "Afternoon", timeLabel: "13:00 - 15:00" },
  { id: "Day-10-Evening", day: 10, period: "Evening", timeLabel: "16:30 - 18:30" },
];

export function getDayDate(dayIndex: number, startDateStr: string = "2026-06-15"): string {
  try {
    const baseDate = new Date(startDateStr);
    if (isNaN(baseDate.getTime())) return `Day ${dayIndex}`;
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + (dayIndex - 1));
    return targetDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return `Day ${dayIndex}`;
  }
}

export function getTimeslotExact(slotId: string | undefined, startDateStr: string = "2026-06-15"): string {
  if (!slotId) return "Unscheduled";
  const parts = slotId.split("-");
  if (parts.length < 3) return slotId.replace(/-/g, " ");
  const dayIndex = parseInt(parts[1]) || 1;
  const period = parts[2] || "";
  
  const ts = DEFAULT_TIMESLOTS.find((t) => t.id === slotId);
  const timeLabel = ts ? ts.timeLabel : (period === "Morning" ? "09:00 - 11:00" : period === "Afternoon" ? "13:00 - 15:00" : "16:30 - 18:30");

  try {
    const baseDate = new Date(startDateStr);
    if (isNaN(baseDate.getTime())) return `Day ${dayIndex}, ${period} (${timeLabel})`;
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + (dayIndex - 1));
    const dateFormatted = targetDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    return `${dateFormatted}, ${timeLabel}`;
  } catch (e) {
    return `Day ${dayIndex}, ${period} (${timeLabel})`;
  }
}

// Configurable standard weights mapping
export const DEFAULT_WEIGHTS: ConstraintWeights = {
  studentConflict: 1000,
  roomCapacity: 200,
  accommodationMatch: 300,
  invigilatorOverlap: 500,
  travelTime: 80,
  roomUtilization: 10,
  invigilatorWorkload: 50,
  cheatingSeparation: 30,
  strictBranchSeparation: false,
};

/**
 * Pre-builds a Map<courseId, Student[]> index for O(1) enrollment lookups.
 * Call ONCE before any hot loop instead of calling getCourseEnrollment repeatedly.
 */
export function buildEnrollmentIndex(students: Student[]): Map<string, Student[]> {
  const index = new Map<string, Student[]>();
  for (const s of students) {
    for (const cId of s.courses) {
      let list = index.get(cId);
      if (!list) { list = []; index.set(cId, list); }
      list.push(s);
    }
  }
  return index;
}

/**
 * Returns students enrolled for a specific course.
 * Accepts an optional pre-built enrollment index for O(1) lookups.
 */
export function getCourseEnrollment(
  courseId: string,
  students: Student[],
  enrollmentIndex?: Map<string, Student[]>
): Student[] {
  if (enrollmentIndex) return enrollmentIndex.get(courseId) || [];
  return students.filter((s) => s.courses.includes(courseId));
}

/**
 * Calculates the number of same-year horizontal adjacencies for a given room's default seating layout
 */
export function getSeatingRiskCount(
  room: Room,
  coursesInRoom: Course[],
  students: Student[],
  activeEntries: ScheduleEntry[],
  enrollmentIndex?: Map<string, Student[]>
): number {
  // Build a Set of active course IDs for fast lookup
  const activeCourseIds = new Set(activeEntries.map(e => e.courseId));

  const enrolledStudents: Student[] = [];
  for (const ent of activeEntries) {
    const enroll = enrollmentIndex ? (enrollmentIndex.get(ent.courseId) || []) : students.filter((s) => s.courses.includes(ent.courseId));
    enrolledStudents.push(...enroll);
  }

  const numCols = 6;
  const numRows = Math.ceil(room.capacity / numCols);
  if (numRows <= 0 || numCols <= 0) return 0;
  const gridTotalSeats = numRows * numCols;
  const defaultArr: (string | null)[] = new Array(gridTotalSeats).fill(null);

  // Build a courseId -> year mapping
  const courseYearMap = new Map<string, number>();
  for (const c of coursesInRoom) {
    courseYearMap.set(c.id, c.year || 1);
  }

  // Helper to get student's academic year
  const getStudentYear = (s: Student, cid: string): number => {
    if (s.year !== undefined && s.year !== null) return s.year;
    return courseYearMap.get(cid) || 1;
  };

  // Group students by course ID, sorted by roll number
  const groups: Record<string, Student[]> = {};
  for (const s of enrolledStudents) {
    const cid = s.courses.find((c) => activeCourseIds.has(c)) || "unknown";
    if (!groups[cid]) groups[cid] = [];
    groups[cid].push(s);
  }
  for (const cid of Object.keys(groups)) {
    groups[cid].sort((a, b) => a.id.localeCompare(b.id));
  }

  // Build mutable queues per course
  const queues: Record<string, Student[]> = {};
  for (const cid of Object.keys(groups)) { queues[cid] = [...groups[cid]]; }
  const courseIds = Object.keys(queues);

  // --- Zero-Adjacency Row-Scan Greedy Allocator ---
  // Track year assignment per grid position for O(1) neighbor check
  const gridYear: (number | null)[] = new Array(gridTotalSeats).fill(null);

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;

      // Determine the year of the left neighbour via grid lookup (O(1))
      const leftYear = c > 0 ? gridYear[idx - 1] : null;

      // Pick the course with the most students remaining whose year is DIFFERENT from leftYear
      let bestCid: string | null = null;
      let bestCount = -1;
      for (const cid of courseIds) {
        if (queues[cid].length > 0) {
          const cYear = courseYearMap.get(cid) || 1;
          if (cYear !== leftYear) {
            if (queues[cid].length > bestCount) {
              bestCount = queues[cid].length;
              bestCid = cid;
            }
          }
        }
      }
      // Fallback: only courses of same year remain
      if (bestCid === null) {
        for (const cid of courseIds) {
          if (queues[cid].length > 0) { bestCid = cid; break; }
        }
      }

      if (bestCid && queues[bestCid].length > 0) {
        const stu = queues[bestCid].shift()!;
        defaultArr[idx] = stu.id;
        gridYear[idx] = getStudentYear(stu, bestCid);
      }
    }
  }

  // If all students in the room are of the same academic year, horizontal adjacency is unavoidable.
  // Bypass/skip risk flagging.
  const activeYears = new Set(gridYear.filter((y): y is number => y !== null));
  if (activeYears.size <= 1) {
    return 0;
  }

  // Evaluate Risk Count using gridYear for O(1) comparisons
  let riskCount = 0;
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;
      const y = gridYear[idx];
      if (y === null) continue;

      // Check left neighbor
      if (c > 0 && gridYear[idx - 1] === y) { riskCount++; continue; }
      // Check right neighbor
      if (c < numCols - 1 && gridYear[idx + 1] === y) { riskCount++; }
    }
  }

  return riskCount;
}

/**
 * Generates initial static mock dataset to bootstrap local use
 */
export function generateDefaultDataset() {
  const courses: Course[] = [
    { id: "CS-101", name: "Introduction to Computer Science", duration: 120, priority: "High", branch: "Computer Science & Eng" },
    { id: "MATH-201", name: "Differential Calculus", duration: 180, priority: "High", branch: "Computer Science & Eng" },
    { id: "PHY-110", name: "Physics: Optics & Electromagnetism", duration: 120, priority: "Medium", branch: "Electrical & Electronics" },
    { id: "CHEM-120", name: "Analytical Organic Chemistry", duration: 150, priority: "Medium", branch: "Business & Humanities" },
    { id: "BIO-101", name: "Cellular & Molecular Biology", duration: 120, priority: "Low", branch: "Business & Humanities" },
    { id: "LIT-305", name: "Contemporary Literature Studies", duration: 90, priority: "Low", branch: "Business & Humanities" },
    { id: "23IT301", name: "Information Technology", duration: 120, priority: "High", branch: "Computer Science & Eng" },
    { id: "ENG-220", name: "Advanced Engineering Design", duration: 180, priority: "High", branch: "Mechanical Engineering" },
  ];

  const rooms: Room[] = [
    { id: "RM-101", name: "Grand Exhibition Hall", capacity: 50, building: "Science Block A", accessible: true },
    { id: "RM-204", name: "Advanced Computing Lab", capacity: 25, building: "Turing Plaza", accessible: true },
    { id: "RM-305", name: "General Lecture Room", capacity: 30, building: "Liberal Arts Wing", accessible: false },
    { id: "RM-12", name: "Scribe Annex Room 3", capacity: 10, building: "Administration Ground", accessible: true },
  ];

  const invigilators: Invigilator[] = [
    { id: "INV-101", name: "Dr. Elizabeth Vance", department: "Science", availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning"], maxWorkload: 3 },
    { id: "INV-102", name: "Prof. Marcus Brody", department: "Linguistics", availability: ["Day-1-Morning", "Day-1-Evening", "Day-2-Afternoon", "Day-3-Afternoon"], maxWorkload: 2 },
    { id: "INV-103", name: "Dr. Sarah Connor", department: "Mathematics", availability: ["Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning", "Day-3-Afternoon", "Day-3-Evening"], maxWorkload: 4 },
    { id: "INV-104", name: "Dr. Henry Jones", department: "History", availability: ["Day-1-Evening", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning", "Day-3-Evening"], maxWorkload: 3 },
    { id: "INV-105", name: "Prof. Rupert Giles", department: "Humanities", availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-3-Afternoon", "Day-3-Evening"], maxWorkload: 3 },
  ];

  // Raw mock student enrollment mapping (some with specific accommodations)
  const students: Student[] = [
    { id: "STU-01", name: "Bruce Wayne", email: "bruce.wayne@waynecorp.com", courses: ["CS-101", "MATH-201", "ENG-220"], accommodations: [] },
    { id: "STU-02", name: "Clark Kent", email: "clark.kent@dailyplanet.com", courses: ["MATH-201", "PHY-110", "23IT301"], accommodations: ["extra_time"] },
    { id: "STU-03", name: "Diana Prince", email: "diana.prince@museum.org", courses: ["PHY-110", "CHEM-120", "LIT-305"], accommodations: [] },
    { id: "STU-04", name: "Barry Allen", email: "barry.allen@ccpd.gov", courses: ["CS-101", "23IT301"], accommodations: ["separate_room"] },
    { id: "STU-05", name: "Arthur Curry", email: "arthur.curry@atlantis.net", courses: ["LIT-305", "BIO-101"], accommodations: ["accessible"] },
    { id: "STU-06", name: "Hal Jordan", email: "hal.jordan@ferris.com", courses: ["ENG-220", "PHY-110"], accommodations: [] },
    { id: "STU-07", name: "Victor Stone", email: "victor.stone@star-labs.com", courses: ["23IT301", "ENG-220", "CS-101"], accommodations: ["separate_room", "accessible"] },
    { id: "STU-08", name: "Oliver Queen", email: "oliver.queen@queenind.com", courses: ["MATH-201", "CHEM-120"], accommodations: [] },
    { id: "STU-09", name: "Selina Kyle", email: "selina.kyle@gotham.org", courses: ["CS-101", "LIT-305", "BIO-101"], accommodations: ["extra_time"] },
    { id: "STU-10", name: "Bruce Banner", email: "bruce.banner@culver.edu", courses: ["PHY-110", "CHEM-120", "BIO-101"], accommodations: ["separate_room", "scribe"] },
    { id: "STU-11", name: "Tony Stark", email: "tony.stark@starkindustries.com", courses: ["23IT301", "ENG-220", "MATH-201"], accommodations: [] },
    { id: "STU-12", name: "Peter Parker", email: "peter.parker@dailybugle.com", courses: ["BIO-101", "MATH-201"], accommodations: ["extra_time"] },
    { id: "STU-13", name: "Natasha Romanoff", email: "natasha.romanoff@shield.gov", courses: ["CS-101", "23IT301"], accommodations: [] },
    { id: "STU-14", name: "Steve Rogers", email: "steve.rogers@army.mil", courses: ["LIT-305", "ENG-220"], accommodations: ["accessible"] },
    { id: "STU-15", name: "Wanda Maximoff", email: "wanda.maximoff@avengers.org", courses: ["CHEM-120", "PHY-110"], accommodations: ["separate_room"] },
  ];

  return { courses, rooms, invigilators, students };
}

/**
 * Validates manual moves or checks conflicts in the entire exam schedule
 */
export function getConflictReport(
  entries: ScheduleEntry[],
  courses: Course[],
  students: Student[],
  rooms: Room[],
  invigilators: Invigilator[],
  weights: ConstraintWeights = DEFAULT_WEIGHTS,
  enrollmentIndex?: Map<string, Student[]>
): ConflictReport[] {
  const reports: ConflictReport[] = [];

  // Build enrollment index if not provided
  const eIdx = enrollmentIndex || buildEnrollmentIndex(students);

  // Build fast lookup maps for rooms, courses, and invigilators (O(1) vs O(n) find)
  const roomMap = new Map<string, Room>();
  for (const r of rooms) roomMap.set(r.id, r);
  const courseMap = new Map<string, Course>();
  for (const c of courses) courseMap.set(c.id, c);
  const invigilatorMap = new Map<string, Invigilator>();
  for (const i of invigilators) invigilatorMap.set(i.id, i);

  // Index mapping to speed up lookups
  const entryByCourse = new Map<string, ScheduleEntry>();
  const entriesBySlotRoom = new Map<string, ScheduleEntry[]>();
  const entriesBySlotInvigilator = new Map<string, ScheduleEntry[]>();
  const entriesBySlot = new Map<string, ScheduleEntry[]>();

  for (const entry of entries) {
    entryByCourse.set(entry.courseId, entry);
    
    // Skip grouping & conflict verification if the entry is not scheduled
    if (!entry.timeslotId || !entry.roomId) {
      continue;
    }

    // group by timeslot
    const slotList = entriesBySlot.get(entry.timeslotId) || [];
    slotList.push(entry);
    entriesBySlot.set(entry.timeslotId, slotList);

    // slot + room
    const keySR = `${entry.timeslotId}_${entry.roomId}`;
    const srList = entriesBySlotRoom.get(keySR) || [];
    srList.push(entry);
    entriesBySlotRoom.set(keySR, srList);

    // slot + invigilator
    if (entry.invigilatorId) {
      const keySI = `${entry.timeslotId}_${entry.invigilatorId}`;
      const siList = entriesBySlotInvigilator.get(keySI) || [];
      siList.push(entry);
      entriesBySlotInvigilator.set(keySI, siList);
    }
  }

  // 1. HARD CONSTRAINT: Student conflicts (Two exams simultaneously)
  const studentsMap = new Map<string, string[]>(); // studentId -> timeslots assigned
  for (const student of students) {
    const assignedSlots: { slotId: string; courseId: string; courseName: string }[] = [];
    for (const cId of student.courses) {
      const ent = entryByCourse.get(cId);
      if (ent) {
        assignedSlots.push({
          slotId: ent.timeslotId,
          courseId: cId,
          courseName: courseMap.get(cId)?.name || cId,
        });
      }
    }

    // Check for overlaps
    const seenSlots = new Map<string, string>();
    for (const s of assignedSlots) {
      if (seenSlots.has(s.slotId)) {
        reports.push({
          id: `stu_${student.id}_${s.slotId}_${s.courseId}`,
          type: "Hard",
          category: "Student Overlap",
          message: `Student "${student.name}" is scheduled for overlapping exams simultaneously in timeslot: [${s.slotId}] ("${seenSlots.get(s.slotId)}" & "${s.courseName}")`,
          impactScore: weights.studentConflict,
        });
      } else {
        seenSlots.set(s.slotId, s.courseName);
      }
    }
  }

  // 2. HARD CONSTRAINT: Room Overflows & Room attributes
  for (const [keySR, activeEntries] of entriesBySlotRoom.entries()) {
    const roomId = keySR.split("_")[1];
    const roomObj = roomMap.get(roomId);
    if (!roomObj) continue;

    // Calculate sum of students scheduled in this room during this timeslot
    let totalEnrolled = 0;
    const coursesInRoom: string[] = [];
    const accommodationNeedsInRoom = new Set<string>();

    for (const ent of activeEntries) {
      const sEnrolled = getCourseEnrollment(ent.courseId, students, eIdx);
      totalEnrolled += sEnrolled.length;
      coursesInRoom.push(ent.courseId);
      
      // Collect accommodation needs of enrolled students
      sEnrolled.forEach((stu) => {
        stu.accommodations.forEach((acc) => accommodationNeedsInRoom.add(acc));
      });
    }

    if (totalEnrolled > roomObj.capacity) {
      reports.push({
        id: `room_${keySR}_cap`,
        type: "Hard",
        category: "Room Overflow",
        message: `Timeslot [${activeEntries[0].timeslotId}]: Exam room "${roomObj.name}" exceeds capacity! Enrolled students: ${totalEnrolled}, Room capacity limit: ${roomObj.capacity}`,
        impactScore: (totalEnrolled - roomObj.capacity) * weights.roomCapacity,
      });
    }

    // Branch limit constraint checking (max 1 for strict separation, or max 3 by default)
    const limit = weights.strictBranchSeparation ? 1 : 3;
    const uniqueBranches = new Set<string>();
    for (const ent of activeEntries) {
      const cObj = courseMap.get(ent.courseId);
      if (cObj?.branch) {
        uniqueBranches.add(cObj.branch);
      }
    }
    if (uniqueBranches.size > limit) {
      reports.push({
        id: `room_${keySR}_branches`,
        type: "Hard",
        category: "Room Overflow",
        message: `Timeslot [${activeEntries[0].timeslotId}]: Exam room "${roomObj.name}" has students from ${uniqueBranches.size} different branches (${Array.from(uniqueBranches).join(", ")}). Maximum allowed is ${limit} branch(es).`,
        impactScore: (uniqueBranches.size - limit) * weights.roomCapacity * 1.5,
      });
    }

    // Seating Proximity check (same-year side-by-side adjacency)
    const activeCourses = activeEntries.map((e) => courseMap.get(e.courseId)).filter(Boolean) as Course[];
    const seatingRisk = getSeatingRiskCount(roomObj, activeCourses, students, activeEntries, eIdx);
    if (seatingRisk > 0) {
      reports.push({
        id: `room_${keySR}_seating_risk`,
        type: "Hard",
        category: "Cheating Risk",
        message: `Timeslot [${activeEntries[0].timeslotId}]: Exam room "${roomObj.name}" has ${seatingRisk} instance(s) of same-year students seated horizontally adjacent.`,
        impactScore: seatingRisk * weights.cheatingSeparation * 10,
      });
    }

    // 3. HARD CONSTRAINT: Accommodation Match
    if (accommodationNeedsInRoom.has("accessible") && !roomObj.accessible) {
      reports.push({
        id: `room_${keySR}_accessibility`,
        type: "Hard",
        category: "Accommodation Mismatch",
        message: `Wheelchair-accessible candidate assigned to room "${roomObj.name}" in building "${roomObj.building}" which lacks wheelchair ramp entry.`,
        impactScore: weights.accommodationMatch,
      });
    }

    if (accommodationNeedsInRoom.has("separate_room") && roomObj.capacity > 15 && activeEntries.length > 0) {
      // Small check: Students requesting separate quiet space should ideally be in low capacity annexes (<15 people total)
      reports.push({
        id: `room_${keySR}_separate`,
        type: "Soft",
        category: "Accommodation Mismatch",
        message: `Quiet-accommodated candidate scheduled in high-capacity hall "${roomObj.name}" (${roomObj.capacity} seats). Annex separate room is requested.`,
        impactScore: weights.accommodationMatch * 0.4,
      });
    }
  }

  // 4. HARD CONSTRAINT: Invigilator Clashes
  for (const [keySI, activeEntries] of entriesBySlotInvigilator.entries()) {
    if (activeEntries.length > 1) {
      const uniqueRoomIds = new Set(activeEntries.map((e) => e.roomId));
      if (uniqueRoomIds.size > 1) {
        const timeslotId = keySI.split("_")[0];
        const invigId = keySI.split("_")[1];
        const invigObj = invigilatorMap.get(invigId);
        const roomsNames = activeEntries
          .map((e) => roomMap.get(e.roomId)?.name || e.roomId)
          .join(" & ");

        reports.push({
          id: `invig_${invigId}_clash_${timeslotId}`,
          type: "Hard",
          category: "Invigilator Clash",
          message: `Invigilator "${invigObj?.name || invigId}" is double-booked across distinct rooms: (${roomsNames}) during Slot: ${timeslotId}`,
          impactScore: weights.invigilatorOverlap * (uniqueRoomIds.size - 1),
        });
      }
    }
  }

  // Check Invigilator Timeslot Availability
  for (const entry of entries) {
    if (!entry.timeslotId || !entry.roomId) continue;
    if (entry.invigilatorId) {
      const invig = invigilatorMap.get(entry.invigilatorId);
      if (invig && !invig.availability.includes(entry.timeslotId)) {
        reports.push({
          id: `invig_${invig.id}_unavail_${entry.timeslotId}_${entry.courseId}`,
          type: "Hard",
          category: "Invigilator Clash",
          message: `Invigilator "${invig.name}" is scheduled for course exam "${courseMap.get(entry.courseId)?.name}" in slot [${entry.timeslotId}] but marked unavailable.`,
          impactScore: weights.invigilatorOverlap * 0.5,
        });
      }
    }
  }

  // Check Invigilator Max Workloads (Soft Constraint but penalized)
  const invigSlots = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.timeslotId || !entry.roomId) continue;
    if (entry.invigilatorId) {
      const slotSet = invigSlots.get(entry.invigilatorId) || new Set<string>();
      slotSet.add(entry.timeslotId);
      invigSlots.set(entry.invigilatorId, slotSet);
    }
  }
  for (const [invigId, slotSet] of invigSlots.entries()) {
    const count = slotSet.size;
    const invig = invigilatorMap.get(invigId);
    if (invig && count > invig.maxWorkload) {
      reports.push({
        id: `invig_workload_${invigId}`,
        type: "Soft",
        category: "Invigilator Workload",
        message: `Invigilator "${invig.name}" exceeds max workload limit: assigned ${count} duties (Limit: ${invig.maxWorkload})`,
        impactScore: (count - invig.maxWorkload) * weights.invigilatorWorkload,
      });
    }
  }

  // 5. SOFT CONSTRAINT: Travel Time Optimization (Back-to-back exams)
  // Check daily transits for students
  for (const student of students) {
    // Find timeslots student is taking exams
    const stuEntries: { day: number; period: SlotPeriod; slotId: string; room: Room; courseId: string }[] = [];
    for (const cId of student.courses) {
      const ent = entryByCourse.get(cId);
      if (ent) {
        const slot = DEFAULT_TIMESLOTS.find((ts) => ts.id === ent.timeslotId);
        const rmObj = roomMap.get(ent.roomId);
        if (slot && rmObj) {
          stuEntries.push({ day: slot.day, period: slot.period, slotId: slot.id, room: rmObj, courseId: cId });
        }
      }
    }

    // Sort student's exam periods
    // Morning -> Afternoon (back-to-back)
    // Afternoon -> Evening (back-to-back)
    for (let i = 0; i < stuEntries.length; i++) {
      for (let j = i + 1; j < stuEntries.length; j++) {
        const e1 = stuEntries[i];
        const e2 = stuEntries[j];
        if (e1.day === e2.day) {
          const isBackToBack =
            (e1.period === "Morning" && e2.period === "Afternoon") ||
            (e1.period === "Afternoon" && e2.period === "Evening") ||
            (e2.period === "Morning" && e1.period === "Afternoon") ||
            (e2.period === "Afternoon" && e1.period === "Evening");

          if (isBackToBack && e1.room.building !== e2.room.building) {
            reports.push({
              id: `travel_${student.id}_${e1.day}_${e1.period}_${e1.courseId}_${e2.courseId}`,
              type: "Soft",
              category: "Travel Conflict",
              message: `Student "${student.name}" has back-to-back exams in different buildings: "${e1.room.building}" -> "${e2.room.building}" on Day ${e1.day}. (No travel buffer)`,
              impactScore: weights.travelTime,
            });
          }
        }
      }
    }
  }

  // 6. SOFT CONSTRAINT: High-risk same-location cheating separation
  // If multiple exams are assigned to the SAME room at the SAME timeslot, is there a risk?
  // Also we check if students taking the same exam sit adjacent in seating plans.
  for (const [keySR, activeEntries] of entriesBySlotRoom.entries()) {
    if (activeEntries.length > 1) {
      // Multiple courses writing in the same room is generally okay, but could create confusion or high density
      const totalEnrolled = activeEntries.reduce(
        (sum, ent) => sum + getCourseEnrollment(ent.courseId, students, eIdx).length,
        0
      );
      const room = roomMap.get(keySR.split("_")[1]);
      if (room && totalEnrolled > room.capacity * 0.8) {
        reports.push({
          id: `cheating_density_${keySR}`,
          type: "Soft",
          category: "Cheating Risk",
          message: `Hall "${room.name}" is highly crowded (${totalEnrolled}/${room.capacity} seats). Consider scattering courses across multiple rooms.`,
          impactScore: weights.cheatingSeparation * 0.5,
        });
      }
    }
  }

  return reports;
}

/**
 * High-performance full mathematical scheduling evaluator
 */
export function evaluateSchedule(
  entries: ScheduleEntry[],
  courses: Course[],
  students: Student[],
  rooms: Room[],
  invigilators: Invigilator[],
  weights: ConstraintWeights = DEFAULT_WEIGHTS,
  enrollmentIndex?: Map<string, Student[]>
): EvaluationMetrics {
  const eIdx = enrollmentIndex || buildEnrollmentIndex(students);
  const reports = getConflictReport(entries, courses, students, rooms, invigilators, weights, eIdx);

  let totalCost = 0;
  let conflictPenalty = 0;
  let travelPenalty = 0;
  let roomWaste = 0;
  let invigilatorOverload = 0;
  let cheatingRiskScore = 0;

  let studentConflictCount = 0;
  let roomCapacityViolations = 0;
  let accommodationMismatches = 0;
  let invigilatorOverlapCount = 0;
  let travelViolationCount = 0;

  for (const report of reports) {
    totalCost += report.impactScore;
    
    if (report.category === "Student Overlap") {
      conflictPenalty += report.impactScore;
      studentConflictCount++;
    } else if (report.category === "Room Overflow") {
      conflictPenalty += report.impactScore;
      roomCapacityViolations++;
    } else if (report.category === "Accommodation Mismatch") {
      conflictPenalty += report.impactScore;
      accommodationMismatches++;
    } else if (report.category === "Invigilator Clash") {
      conflictPenalty += report.impactScore;
      invigilatorOverlapCount++;
    } else if (report.category === "Invigilator Workload") {
      invigilatorOverload += report.impactScore;
    } else if (report.category === "Travel Conflict") {
      travelPenalty += report.impactScore;
      travelViolationCount++;
    } else if (report.category === "Cheating Risk") {
      cheatingRiskScore += report.impactScore;
      if (report.id.includes("seating_risk")) {
        conflictPenalty += report.impactScore;
      }
    }
  }

  // Calculate Average Room Utilization and Wasted Capacity
  let totalWastedCapacity = 0;
  let activeRoomsCount = 0;
  let totalUtilizationPctSum = 0;

  // Group scheduled courses by Slot + Room to see utilization of scheduled cells
  const slotRoomGroups = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.timeslotId || !entry.roomId) continue;
    const key = `${entry.timeslotId}_${entry.roomId}`;
    const courseIds = slotRoomGroups.get(key) || [];
    courseIds.push(entry.courseId);
    slotRoomGroups.set(key, courseIds);
  }

  for (const [key, courseIds] of slotRoomGroups.entries()) {
    const roomId = key.split("_")[1];
    const room = rooms.find((r) => r.id === roomId);
    if (!room) continue;

    activeRoomsCount++;
    let roomEnrolled = 0;
    for (const cId of courseIds) {
      roomEnrolled += getCourseEnrollment(cId, students, eIdx).length;
    }

    const pct = Math.min(100, Math.round((roomEnrolled / room.capacity) * 100));
    totalUtilizationPctSum += pct;

    if (roomEnrolled < room.capacity) {
      const unused = room.capacity - roomEnrolled;
      totalWastedCapacity += unused;
      roomWaste += unused * weights.roomUtilization;
    }
  }

  const averageRoomUtilization = activeRoomsCount > 0 ? Math.round(totalUtilizationPctSum / activeRoomsCount) : 0;
  totalCost += roomWaste;

  // Accommodation Compliance Percentage (100% means zero mismatches)
  const accommodationCompliance = accommodationMismatches === 0 ? 100 : Math.max(0, 100 - (accommodationMismatches * 15));

  let seatingRiskCount = 0;
  for (const report of reports) {
    if (report.id.includes("seating_risk")) {
      const divisor = weights.cheatingSeparation * 10 || 300;
      seatingRiskCount += Math.round(report.impactScore / divisor);
    }
  }

  // High-level compliance formula
  const compliancePercentage = Math.max(
    0,
    Math.min(
      100,
      100 - (studentConflictCount * 25 + roomCapacityViolations * 15 + accommodationMismatches * 10 + invigilatorOverlapCount * 20 + travelViolationCount * 5 + seatingRiskCount * 10)
    )
  );

  const scheduledCourseIds = new Set(
    entries
      .filter((e) => e.timeslotId && e.roomId)
      .map((e) => e.courseId)
  );
  const unassignedExams = courses.filter((c) => !scheduledCourseIds.has(c.id)).length;

  return {
    totalCost: Math.round(totalCost),
    conflictPenalty,
    travelPenalty,
    roomWaste: Math.round(roomWaste),
    invigilatorOverload,
    cheatingRiskScore,
    studentConflictCount,
    roomCapacityViolations,
    accommodationMismatches,
    invigilatorOverlapCount,
    travelViolationCount,
    compliancePercentage,
    averageRoomUtilization,
    unassignedExams,
  };
}

/**
 * Runs the schedule optimization generation algorithm.
 * Uses a hybrid backtracking with adaptive simulated-annealing local search to resolve conflicts.
 * Optimized with: pre-built enrollment index, conflict-guided mutations, and early zero-cost exit.
 */
export function runOptimization(
  courses: Course[],
  students: Student[],
  rooms: Room[],
  invigilators: Invigilator[],
  weights: ConstraintWeights = DEFAULT_WEIGHTS,
  onProgress: (entries: ScheduleEntry[], stats: EvaluationMetrics, i: number, maxI: number) => void,
  maxIterations = 800
) {
  const timeslots = DEFAULT_TIMESLOTS;

  // ── Pre-build enrollment index ONCE (O(1) lookups throughout) ──
  const enrollmentIndex = buildEnrollmentIndex(students);
  
  // Create an initial randomized / greedy baseline assignment
  let currentEntries: ScheduleEntry[] = [];
  
  // Sort courses by degree of difficulty or size (Higher priority and enrollment first)
  const sortedCourses = [...courses].sort((a, b) => {
    const aCount = getCourseEnrollment(a.id, students, enrollmentIndex).length;
    const bCount = getCourseEnrollment(b.id, students, enrollmentIndex).length;
    
    // Sort by priority first
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (pDiff !== 0) return pDiff;
    
    return bCount - aCount;
  });

  // ── Pre-sort rooms by capacity for fast best-fit selection ──
  const roomsByCapacity = [...rooms].sort((a, b) => a.capacity - b.capacity);

  // Assign a greedily picked timeslot, room, and invigilator for each course
  for (const course of sortedCourses) {
    const enrollCount = getCourseEnrollment(course.id, students, enrollmentIndex).length;
    
    // Find rooms that can fit this enrollment, preferring smaller fits to prevent waste
    // Binary-search-like: roomsByCapacity is pre-sorted, find first that fits
    const eligibleRooms = roomsByCapacity.filter((r) => r.capacity >= enrollCount);

    const fallbackRoom = eligibleRooms.length > 0 ? eligibleRooms[0] : rooms[0] || { id: "" };
    const randomSlot = timeslots[Math.floor(Math.random() * timeslots.length)];
    
    // Look for available invigilators for this slot
    const slotInvigs = invigilators.filter((iv) => iv.availability.includes(randomSlot?.id));
    const invig = slotInvigs[Math.floor(Math.random() * slotInvigs.length)] || invigilators[0] || { id: "" };

    currentEntries.push({
      id: `ent_${course.id}`,
      courseId: course.id,
      timeslotId: randomSlot?.id || "",
      roomId: fallbackRoom.id || "",
      invigilatorId: invig.id || "",
    });
  }

  let bestEntries = [...currentEntries.map(e => ({ ...e }))];
  let bestMetrics = evaluateSchedule(bestEntries, courses, students, rooms, invigilators, weights, enrollmentIndex);
  
  // Optimization Loop — conflict-guided simulated annealing
  for (let step = 0; step < maxIterations; step++) {
    // ── Early exit: perfect schedule (zero total cost) ──
    if (bestMetrics.totalCost === 0) break;

    // If we reached clean 0 hard conflicts, we can continue optimizing soft factors but exit earlier
    if (bestMetrics.studentConflictCount === 0 && 
        bestMetrics.roomCapacityViolations === 0 && 
        bestMetrics.invigilatorOverlapCount === 0 && 
        bestMetrics.unassignedExams === 0 &&
        step > maxIterations * 0.4) {
      break; 
    }

    const candidateEntries = currentEntries.map(e => ({ ...e }));

    // ── Conflict-guided mutation: prefer mutating entries involved in conflicts ──
    let targetIdx: number;
    if (Math.random() < 0.7) {
      // 70% of the time: target an entry that's involved in a current conflict
      const conflicts = getConflictReport(currentEntries, courses, students, rooms, invigilators, weights, enrollmentIndex);
      if (conflicts.length > 0) {
        // Extract course IDs mentioned in conflicts
        const conflictCourseIds = new Set<string>();
        for (const c of conflicts) {
          // Match course IDs from the conflict entries
          for (const ent of currentEntries) {
            if (c.message.includes(ent.courseId) || c.id.includes(ent.courseId)) {
              conflictCourseIds.add(ent.courseId);
            }
          }
        }
        // Pick a random conflicting entry
        const conflictEntryIdxs = candidateEntries
          .map((e, idx) => conflictCourseIds.has(e.courseId) ? idx : -1)
          .filter(idx => idx >= 0);
        targetIdx = conflictEntryIdxs.length > 0
          ? conflictEntryIdxs[Math.floor(Math.random() * conflictEntryIdxs.length)]
          : Math.floor(Math.random() * candidateEntries.length);
      } else {
        targetIdx = Math.floor(Math.random() * candidateEntries.length);
      }
    } else {
      // 30% of the time: random exploration
      targetIdx = Math.floor(Math.random() * candidateEntries.length);
    }

    const targetEntry = candidateEntries[targetIdx];
    if (!targetEntry) continue;

    const action = Math.random();
    if (action < 0.4) {
      // Alter Timeslot
      const otherSlots = timeslots.filter(ts => ts.id !== targetEntry.timeslotId);
      if (otherSlots.length > 0) {
        targetEntry.timeslotId = otherSlots[Math.floor(Math.random() * otherSlots.length)].id;
      }
    } else if (action < 0.7) {
      // Alter Room — prefer rooms that fit the enrollment
      const enrollCount = getCourseEnrollment(targetEntry.courseId, students, enrollmentIndex).length;
      const fittingRooms = roomsByCapacity.filter(r => r.capacity >= enrollCount);
      const candidateRooms = fittingRooms.length > 0 ? fittingRooms : rooms;
      if (candidateRooms.length > 0) {
        targetEntry.roomId = candidateRooms[Math.floor(Math.random() * candidateRooms.length)].id;
      }
    } else {
      // Alter Invigilator — prefer available ones for the target slot
      const slotInvigs = invigilators.filter(iv => iv.availability.includes(targetEntry.timeslotId));
      const candidateInvigs = slotInvigs.length > 0 ? slotInvigs : invigilators;
      if (candidateInvigs.length > 0) {
        targetEntry.invigilatorId = candidateInvigs[Math.floor(Math.random() * candidateInvigs.length)].id;
      }
    }

    const candidateMetrics = evaluateSchedule(candidateEntries, courses, students, rooms, invigilators, weights, enrollmentIndex);
    
    // Accept transition if cost decreases or with a decreasing probability (Simulated Annealing)
    const costDiff = candidateMetrics.totalCost - bestMetrics.totalCost;
    const temp = (1.0 - (step / maxIterations)); // cooling factor
    
    const shouldAccept = costDiff < 0 || (temp > 0.05 && Math.random() < Math.exp(-costDiff / (500 * temp)));

    if (shouldAccept) {
      currentEntries = candidateEntries;
      if (candidateMetrics.totalCost < bestMetrics.totalCost) {
        bestEntries = [...candidateEntries.map(e => ({ ...e }))];
        bestMetrics = candidateMetrics;
      }
    }

    // Trigger visual progressive callback periodically to animated render
    if (step % 25 === 0) {
      onProgress(bestEntries, bestMetrics, step, maxIterations);
    }
  }

  // Final trigger
  onProgress(bestEntries, bestMetrics, maxIterations, maxIterations);
  return bestEntries;
}

/**
 * Generates a simplified minimal dataset (3 courses, 2 rooms, 2 invigilators, 4 students)
 * to allow easily understandable traceable schedules with simple rules.
 */
export function generateSimpleDataset() {
  const courses: Course[] = [
    { id: "MATH-101", name: "Basic Mathematics", duration: 90, priority: "High", branch: "Computer Science & Eng" },
    { id: "ENG-101", name: "English Composition", duration: 90, priority: "Medium", branch: "Business & Humanities" },
    { id: "SCI-101", name: "General Science", duration: 120, priority: "Low", branch: "Electrical & Electronics" },
    { id: "HIST-101", name: "World History", duration: 90, priority: "Medium", branch: "Business & Humanities" },
    { id: "CS-101", name: "Introduction to Computing", duration: 120, priority: "High", branch: "Computer Science & Eng" },
    { id: "PHY-101", name: "Applied Physics", duration: 120, priority: "Medium", branch: "Electrical & Electronics" },
  ];

  const rooms: Room[] = [
    { id: "RM-A", name: "Lecture Hall A", capacity: 60, building: "Main Block", accessible: true },
    { id: "RM-B", name: "Classroom B", capacity: 40, building: "Science Wing", accessible: true },
    { id: "RM-C", name: "Computing Lab C", capacity: 30, building: "Tech Block", accessible: true },
    { id: "RM-D", name: "Seminar Room D", capacity: 25, building: "Arts Building", accessible: false },
    { id: "RM-E", name: "Annex Hall E", capacity: 20, building: "Administration Ground", accessible: true },
  ];

  const invigilators: Invigilator[] = [
    { id: "INV-01", name: "Prof. John Smith", department: "Mathematics", availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon"], maxWorkload: 3 },
    { id: "INV-02", name: "Ms. Clara Davis", department: "Arts", availability: ["Day-1-Morning", "Day-2-Morning", "Day-3-Morning"], maxWorkload: 3 },
    { id: "INV-03", name: "Dr. Rajesh Kumar", department: "Physics", availability: ["Day-1-Afternoon", "Day-2-Morning", "Day-2-Evening", "Day-3-Afternoon"], maxWorkload: 3 },
    { id: "INV-04", name: "Prof. Emily Chan", department: "Computer Science", availability: ["Day-1-Morning", "Day-1-Evening", "Day-2-Afternoon", "Day-3-Morning"], maxWorkload: 3 },
    { id: "INV-05", name: "Mr. Samuel Green", department: "History", availability: ["Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Evening"], maxWorkload: 3 },
    { id: "INV-06", name: "Dr. Ananya Patel", department: "Science", availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-3-Morning", "Day-3-Afternoon"], maxWorkload: 3 },
    { id: "INV-07", name: "Prof. Liu Wei", department: "Engineering", availability: ["Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning", "Day-3-Afternoon"], maxWorkload: 3 },
    { id: "INV-08", name: "Ms. Priya Sharma", department: "Mathematics", availability: ["Day-1-Morning", "Day-1-Evening", "Day-2-Evening", "Day-3-Morning"], maxWorkload: 3 },
    { id: "INV-09", name: "Dr. Marco Rossi", department: "Physics", availability: ["Day-1-Afternoon", "Day-2-Afternoon", "Day-3-Afternoon", "Day-3-Evening"], maxWorkload: 3 },
    { id: "INV-10", name: "Prof. Aisha Okonkwo", department: "Humanities", availability: ["Day-1-Morning", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning"], maxWorkload: 3 },
  ];

  const students: Student[] = [
    { id: "STU-001", name: "Aarav Singh", email: "aarav.singh@college.edu", courses: ["MATH-101", "CS-101"], accommodations: [] },
    { id: "STU-002", name: "Bella Martinez", email: "bella.martinez@college.edu", courses: ["ENG-101", "HIST-101"], accommodations: [] },
    { id: "STU-003", name: "Carlos Rivera", email: "carlos.rivera@college.edu", courses: ["SCI-101", "PHY-101"], accommodations: [] },
    { id: "STU-004", name: "Diana Patel", email: "diana.patel@college.edu", courses: ["MATH-101", "PHY-101"], accommodations: ["extra_time"] },
    { id: "STU-005", name: "Ethan Brooks", email: "ethan.brooks@college.edu", courses: ["CS-101", "HIST-101"], accommodations: [] },
    { id: "STU-006", name: "Fatima Al-Rashid", email: "fatima.al-rashid@college.edu", courses: ["ENG-101", "SCI-101"], accommodations: [] },
    { id: "STU-007", name: "George Okafor", email: "george.okafor@college.edu", courses: ["MATH-101", "SCI-101"], accommodations: [] },
    { id: "STU-008", name: "Hannah Kim", email: "hannah.kim@college.edu", courses: ["PHY-101", "CS-101"], accommodations: ["accessible"] },
    { id: "STU-009", name: "Ivan Petrov", email: "ivan.petrov@college.edu", courses: ["HIST-101", "ENG-101"], accommodations: [] },
    { id: "STU-010", name: "Jasmine Lee", email: "jasmine.lee@college.edu", courses: ["MATH-101", "ENG-101"], accommodations: [] },
    { id: "STU-011", name: "Karan Mehta", email: "karan.mehta@college.edu", courses: ["SCI-101", "CS-101"], accommodations: ["separate_room"] },
    { id: "STU-012", name: "Layla Hassan", email: "layla.hassan@college.edu", courses: ["PHY-101", "HIST-101"], accommodations: [] },
    { id: "STU-013", name: "Marcus Johnson", email: "marcus.johnson@college.edu", courses: ["MATH-101", "HIST-101"], accommodations: [] },
    { id: "STU-014", name: "Nadia Kowalski", email: "nadia.kowalski@college.edu", courses: ["ENG-101", "PHY-101"], accommodations: [] },
    { id: "STU-015", name: "Omar Abdullah", email: "omar.abdullah@college.edu", courses: ["CS-101", "SCI-101"], accommodations: [] },
    { id: "STU-016", name: "Priya Venkat", email: "priya.venkat@college.edu", courses: ["MATH-101", "CS-101"], accommodations: ["extra_time"] },
    { id: "STU-017", name: "Quinn Thompson", email: "quinn.thompson@college.edu", courses: ["ENG-101", "HIST-101"], accommodations: [] },
    { id: "STU-018", name: "Riya Gupta", email: "riya.gupta@college.edu", courses: ["SCI-101", "PHY-101"], accommodations: [] },
    { id: "STU-019", name: "Samuel Adeyemi", email: "samuel.adeyemi@college.edu", courses: ["HIST-101", "CS-101"], accommodations: [] },
    { id: "STU-020", name: "Tanya Volkov", email: "tanya.volkov@college.edu", courses: ["MATH-101", "PHY-101"], accommodations: [] },
    { id: "STU-021", name: "Umar Farooq", email: "umar.farooq@college.edu", courses: ["ENG-101", "CS-101"], accommodations: ["accessible"] },
    { id: "STU-022", name: "Valentina Cruz", email: "valentina.cruz@college.edu", courses: ["SCI-101", "HIST-101"], accommodations: [] },
    { id: "STU-023", name: "William Chen", email: "william.chen@college.edu", courses: ["MATH-101", "ENG-101"], accommodations: [] },
    { id: "STU-024", name: "Xena Alvarez", email: "xena.alvarez@college.edu", courses: ["PHY-101", "CS-101"], accommodations: [] },
    { id: "STU-025", name: "Yusuf Ibrahim", email: "yusuf.ibrahim@college.edu", courses: ["SCI-101", "MATH-101"], accommodations: [] },
    { id: "STU-026", name: "Zara Nkosi", email: "zara.nkosi@college.edu", courses: ["HIST-101", "ENG-101"], accommodations: ["extra_time"] },
    { id: "STU-027", name: "Arjun Reddy", email: "arjun.reddy@college.edu", courses: ["CS-101", "PHY-101"], accommodations: [] },
    { id: "STU-028", name: "Bianca Santos", email: "bianca.santos@college.edu", courses: ["MATH-101", "SCI-101"], accommodations: [] },
    { id: "STU-029", name: "Caleb Owens", email: "caleb.owens@college.edu", courses: ["ENG-101", "PHY-101"], accommodations: [] },
    { id: "STU-030", name: "Diya Joshi", email: "diya.joshi@college.edu", courses: ["HIST-101", "MATH-101"], accommodations: [] },
    { id: "STU-031", name: "Elias Fernandez", email: "elias.fernandez@college.edu", courses: ["CS-101", "SCI-101"], accommodations: ["separate_room"] },
    { id: "STU-032", name: "Freya Larsen", email: "freya.larsen@college.edu", courses: ["PHY-101", "ENG-101"], accommodations: [] },
    { id: "STU-033", name: "Gideon Nwosu", email: "gideon.nwosu@college.edu", courses: ["MATH-101", "HIST-101"], accommodations: [] },
    { id: "STU-034", name: "Hana Tanaka", email: "hana.tanaka@college.edu", courses: ["SCI-101", "CS-101"], accommodations: [] },
    { id: "STU-035", name: "Iskander Yusupov", email: "iskander.yusupov@college.edu", courses: ["ENG-101", "MATH-101"], accommodations: [] },
    { id: "STU-036", name: "Jade Morrison", email: "jade.morrison@college.edu", courses: ["PHY-101", "HIST-101"], accommodations: ["extra_time"] },
    { id: "STU-037", name: "Kai Nakamura", email: "kai.nakamura@college.edu", courses: ["CS-101", "ENG-101"], accommodations: [] },
    { id: "STU-038", name: "Luna Rosario", email: "luna.rosario@college.edu", courses: ["SCI-101", "MATH-101"], accommodations: [] },
    { id: "STU-039", name: "Mikael Bergstrom", email: "mikael.bergstrom@college.edu", courses: ["HIST-101", "PHY-101"], accommodations: [] },
    { id: "STU-040", name: "Nkechi Obi", email: "nkechi.obi@college.edu", courses: ["ENG-101", "CS-101"], accommodations: [] },
    { id: "STU-041", name: "Pablo Guerrero", email: "pablo.guerrero@college.edu", courses: ["MATH-101", "PHY-101"], accommodations: [] },
    { id: "STU-042", name: "Qian Zhang", email: "qian.zhang@college.edu", courses: ["SCI-101", "ENG-101"], accommodations: ["accessible"] },
    { id: "STU-043", name: "Rosa Hernandez", email: "rosa.hernandez@college.edu", courses: ["HIST-101", "CS-101"], accommodations: [] },
    { id: "STU-044", name: "Soren Andersen", email: "soren.andersen@college.edu", courses: ["MATH-101", "SCI-101"], accommodations: [] },
    { id: "STU-045", name: "Tariq Mansouri", email: "tariq.mansouri@college.edu", courses: ["PHY-101", "ENG-101"], accommodations: [] },
    { id: "STU-046", name: "Uma Krishnan", email: "uma.krishnan@college.edu", courses: ["CS-101", "HIST-101"], accommodations: [] },
    { id: "STU-047", name: "Vera Popova", email: "vera.popova@college.edu", courses: ["MATH-101", "ENG-101"], accommodations: [] },
    { id: "STU-048", name: "Wayne Oduya", email: "wayne.oduya@college.edu", courses: ["SCI-101", "CS-101"], accommodations: ["extra_time"] },
    { id: "STU-049", name: "Xiu-Ying Lin", email: "xiu-ying.lin@college.edu", courses: ["PHY-101", "MATH-101"], accommodations: [] },
    { id: "STU-050", name: "Yemi Adebayo", email: "yemi.adebayo@college.edu", courses: ["HIST-101", "SCI-101"], accommodations: [] },
  ];


  return { courses, rooms, invigilators, students };
}

/**
 * Runs a simple, deterministic sequential allocation algorithm.
 * Schedules courses one by one into the first timesloting cell with matching capacity and no proctor clash.
 */
export function runSimpleSequentialAllocation(
  courses: Course[],
  students: Student[],
  rooms: Room[],
  invigilators: Invigilator[],
  strictBranchSeparation = false
): ScheduleEntry[] {
  const timeslots = DEFAULT_TIMESLOTS;
  const entries: ScheduleEntry[] = [];
  const limit = strictBranchSeparation ? 1 : 3;
  const enrollmentIndex = buildEnrollmentIndex(students);

  for (let cIdx = 0; cIdx < courses.length; cIdx++) {
    const course = courses[cIdx];
    const enrollCount = getCourseEnrollment(course.id, students, enrollmentIndex).length;

    // Find first slot, room and invigilator that works without overlap
    let assigned = false;
    for (const slot of timeslots) {
      for (const room of rooms) {
        // Check room capacity limit for already scheduled courses
        const roomEntries = entries.filter((e) => e.timeslotId === slot.id && e.roomId === room.id);
        const currentEnrolled = roomEntries.reduce(
          (sum, e) => sum + students.filter((s) => s.courses.includes(e.courseId)).length,
          0
        );

        if (currentEnrolled + enrollCount > room.capacity) continue;

        // Check unique branches sharing this room (max 1 branch for strict separation, or max 3 by default)
        const uniqueBranches = new Set<string>();
        roomEntries.forEach((e) => {
          const c = courses.find((x) => x.id === e.courseId);
          if (c?.branch) uniqueBranches.add(c.branch);
        });
        if (course.branch) uniqueBranches.add(course.branch);
        if (uniqueBranches.size > limit) continue;

        // Determine invigilator (reuse existing room proctor or pick new one)
        const existingRoomEntry = roomEntries.find((e) => e.invigilatorId);
        let invig;

        if (existingRoomEntry) {
          invig = invigilators.find((iv) => iv.id === existingRoomEntry.invigilatorId);
        } else {
          invig = invigilators.find((iv) => {
            if (!iv.availability.includes(slot.id)) return false;
            // Ensure proctor isn't busy in another distinct room during this slot
            const invigBusyInOtherRoom = entries.some(
              (e) => e.timeslotId === slot.id && e.invigilatorId === iv.id && e.roomId !== room.id
            );
            return !invigBusyInOtherRoom;
          });
        }

        if (invig) {
          entries.push({
            id: `ent_${course.id}`,
            courseId: course.id,
            timeslotId: slot.id,
            roomId: room.id,
            invigilatorId: invig.id,
          });
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }

    // Fallback if no clean slot is found
    if (!assigned) {
      entries.push({
        id: `ent_${course.id}`,
        courseId: course.id,
        timeslotId: timeslots[cIdx % timeslots.length]?.id || "",
        roomId: rooms[cIdx % rooms.length]?.id || "",
        invigilatorId: invigilators[cIdx % invigilators.length]?.id || "",
      });
    }
  }

  return entries;
}
