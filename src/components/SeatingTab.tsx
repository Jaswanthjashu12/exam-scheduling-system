/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Course, Room, Student, Invigilator, ScheduleEntry } from "../types";
import { DEFAULT_TIMESLOTS, getTimeslotExact } from "../utils/solver";
import { Users, Info, ShieldAlert, Check, HelpCircle, AlertTriangle, Move, RotateCcw, Printer, Mail, Loader2, ArrowRightCircle, LogIn } from "lucide-react";
import * as api from "../api/client";

interface SeatingTabProps {
  courses: Course[];
  rooms: Room[];
  students: Student[];
  invigilators: Invigilator[];
  entries: ScheduleEntry[];
  examStartDate?: string;
  collegeName?: string;
  setActiveTab?: (tab: any) => void;
}

export default function SeatingTab({ courses, rooms, students, invigilators, entries, examStartDate = "2026-06-15", collegeName = "", setActiveTab }: SeatingTabProps) {
  const [selectedSlotId, setSelectedSlotId] = useState("Day-1-Morning");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [sendingPlan, setSendingPlan] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [autoSortMode, setAutoSortMode] = useState<"anti-cheat" | "alt-cols" | "alt-rows" | "roll-number" | "branch">(() => {
    return (localStorage.getItem("exam_scheduler_autosort_mode_v2") as any) || "anti-cheat";
  });
  const [fillDirection, setFillDirection] = useState<"row-wise" | "column-wise">(() => {
    return (localStorage.getItem("exam_scheduler_fill_direction_v2") as any) || "column-wise";
  });
  const [enforceGap, setEnforceGap] = useState<boolean>(() => {
    return localStorage.getItem("exam_scheduler_enforce_gap") === "true";
  });
  const [interleaveDepts, setInterleaveDepts] = useState<boolean>(() => {
    return localStorage.getItem("exam_scheduler_interleave_depts") !== "false";
  });
  const [allowDiffBranchSecAdjacent, setAllowDiffBranchSecAdjacent] = useState<boolean>(() => {
    const saved = localStorage.getItem("exam_scheduler_allow_diff_branch_sec_adjacent");
    return saved !== null ? saved === "true" : true;
  });
  // Overflow assignment state — tracks which overflow students go to which room
  interface OverflowAssignment {
    slotId: string;
    fromRoomId: string;
    toRoomId: string;
    studentIds: string[];
  }
  const [overflowAssignments, setOverflowAssignments] = useState<OverflowAssignment[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_overflow_assignments");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedOverflowTargetRoom, setSelectedOverflowTargetRoom] = useState<string>("");

  // Auto-select room on slot change if none selected
  const activeEntries = entries.filter((e) => e.timeslotId === selectedSlotId);
  
  // A room is active if it has scheduled entries OR receives overflow in this slot
  const activeRooms = rooms.filter((r) => 
    activeEntries.some((e) => e.roomId === r.id) ||
    overflowAssignments.some((a) => a.slotId === selectedSlotId && a.toRoomId === r.id)
  );

  const currentRoomId = selectedRoomId || activeRooms[0]?.id || "";

  // Find courses and enrolled students writing in this Room + Timeslot
  const selectedEntries = activeEntries.filter((e) => e.roomId === currentRoomId);
  const coursesInRoom = selectedEntries.map((e) => courses.find((c) => c.id === e.courseId)).filter(Boolean) as Course[];

  // Helper to find the course a student is taking in the current timeslot
  const getStudentCourseInSlot = (s: Student): Course | null => {
    // 1. Look in the currently viewed room's entries first
    const localCid = s.courses.find((cId) => selectedEntries.some((e) => e.courseId === cId));
    if (localCid) return courses.find((c) => c.id === localCid) || null;
    // 2. Look in any room's entries for this slot
    const activeCid = s.courses.find((cId) => activeEntries.some((e) => e.courseId === cId));
    if (activeCid) return courses.find((c) => c.id === activeCid) || null;
    return null;
  };

  // Helper to find the year classification of a student in this slot
  const getStudentYearInSlot = (s: Student): number => {
    const course = getStudentCourseInSlot(s);
    if (course?.year) return course.year;
    if (s.year !== undefined && s.year !== null) return s.year;
    return 1;
  };
  
  // 1. Locally enrolled students (distributed proportionally if a course is in multiple rooms)
  const slotEntries = entries.filter((e) => e.timeslotId === selectedSlotId);
  const courseEntriesMap: Record<string, typeof slotEntries> = {};
  slotEntries.forEach((e) => {
    if (!courseEntriesMap[e.courseId]) courseEntriesMap[e.courseId] = [];
    courseEntriesMap[e.courseId].push(e);
  });

  const studentRoomAssignment: Record<string, string> = {};

  Object.keys(courseEntriesMap).forEach((cid) => {
    const courseEntries = courseEntriesMap[cid];
    const rawStudents = students.filter((s) => s.courses.some(c => c.trim().toUpperCase() === cid.trim().toUpperCase()));
    
    // Group by branch-section to interleave sections/branches across rooms
    const secGroups: Record<string, Student[]> = {};
    rawStudents.forEach((s) => {
      const key = `${(s.branch || '').toUpperCase()}-${(s.section || '').toUpperCase()}`;
      if (!secGroups[key]) secGroups[key] = [];
      secGroups[key].push(s);
    });
    
    // Sort each group alphabetically
    const sortedGroups = Object.keys(secGroups).sort().map((key) => {
      return secGroups[key].sort((a, b) => a.id.localeCompare(b.id));
    });
    
    // Interleave
    const courseStudents: Student[] = [];
    if (sortedGroups.length > 0) {
      const maxLen = Math.max(...sortedGroups.map((g) => g.length));
      for (let i = 0; i < maxLen; i++) {
        for (const g of sortedGroups) {
          if (i < g.length) {
            courseStudents.push(g[i]);
          }
        }
      }
    }

    if (courseEntries.length === 1) {
      courseStudents.forEach((s) => {
        studentRoomAssignment[s.id] = courseEntries[0].roomId;
      });
    } else if (courseEntries.length > 1) {
      const roomsWithCap = courseEntries
        .map((e) => {
          const r = rooms.find((rm) => rm.id === e.roomId);
          return {
            roomId: e.roomId,
            capacity: r?.capacity || 30,
          };
        })
        .sort((a, b) => b.capacity - a.capacity); // Fill larger rooms first

      let assignedCount = 0;
      roomsWithCap.forEach((rObj, idx) => {
        let share = 0;
        if (idx === roomsWithCap.length - 1) {
          share = courseStudents.length - assignedCount;
        } else {
          share = Math.min(rObj.capacity, courseStudents.length - assignedCount);
        }

        const slice = courseStudents.slice(assignedCount, assignedCount + share);
        slice.forEach((s) => {
          studentRoomAssignment[s.id] = rObj.roomId;
        });
        assignedCount += share;
      });
    }
  });

  const enrolledStudents = students.filter((s) => studentRoomAssignment[s.id] === currentRoomId);
  const seenStudentIds = new Set<string>(enrolledStudents.map((s) => s.id));

  // 2. Total students in room (local + overflow arrivals)
  const totalStudentsInRoom = [...enrolledStudents];
  const totalSeenStudentIds = new Set(seenStudentIds);
  const arrivals = overflowAssignments
    .filter((a) => a.slotId === selectedSlotId && a.toRoomId === currentRoomId)
    .flatMap((a) => a.studentIds.map((id) => students.find((s) => s.id === id)).filter(Boolean) as Student[]);

  arrivals.forEach((s) => {
    if (!totalSeenStudentIds.has(s.id)) {
      totalSeenStudentIds.add(s.id);
      totalStudentsInRoom.push(s);
    }
  });

  const roomObj = rooms.find((r) => r.id === currentRoomId);
  const totalCapacity = roomObj?.capacity || 30;

  // --- Grid Layout Configuration (per room+slot) ---
  // Store layout configs keyed by seatKey
  const [gridConfigs, setGridConfigs] = useState<Record<string, { numCols: number; numRows: number; seatsPerCol: number }>>(() => {
    const saved = localStorage.getItem("exam_scheduler_grid_configs");
    return saved ? JSON.parse(saved) : {};
  });

  const seatKey = `${selectedSlotId}_${currentRoomId}`;

  // Derive defaults from room capacity
  const defaultNumCols = 6;
  const defaultNumRows = Math.ceil(totalCapacity / defaultNumCols);
  const defaultSeatsPerCol = defaultNumRows;

  const currentGridConfig = gridConfigs[seatKey] || {
    numCols: defaultNumCols,
    numRows: defaultNumRows,
    seatsPerCol: defaultSeatsPerCol,
  };

  const numCols = Math.max(1, currentGridConfig.numCols);
  const numRows = Math.max(1, currentGridConfig.numRows);
  // seatsPerCol is the number of seats in each column = numRows (they are the same thing)
  // We display seatsPerCol as a linked control; changing it updates numRows
  const seatsPerCol = numRows;

  const updateGridConfig = (patch: Partial<{ numCols: number; numRows: number; seatsPerCol: number }>) => {
    const updated = {
      ...gridConfigs,
      [seatKey]: { ...currentGridConfig, ...patch },
    };
    setGridConfigs(updated);
    localStorage.setItem("exam_scheduler_grid_configs", JSON.stringify(updated));
    setSelectedSeatIndex(null);
  };

  // Total visible seats in grid = numRows * numCols
  const gridTotalSeats = numRows * numCols;

  // Track custom manual seating layouts
  const [customSeating, setCustomSeating] = useState<Record<string, (string | null)[]>>(() => {
    const saved = localStorage.getItem("exam_scheduler_custom_seating");
    return saved ? JSON.parse(saved) : {};
  });

  const handleEnforceGapChange = (val: boolean) => {
    setEnforceGap(val);
    localStorage.setItem("exam_scheduler_enforce_gap", String(val));
    // Clear custom overrides to trigger auto-sort update immediately
    const updated = { ...customSeating };
    delete updated[seatKey];
    setCustomSeating(updated);
    localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
    setSelectedSeatIndex(null);
  };

  const handleInterleaveDeptsChange = (val: boolean) => {
    setInterleaveDepts(val);
    localStorage.setItem("exam_scheduler_interleave_depts", String(val));
    // Clear custom overrides to trigger auto-sort update immediately
    const updated = { ...customSeating };
    delete updated[seatKey];
    setCustomSeating(updated);
    localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
    setSelectedSeatIndex(null);
  };

  // Track the source seat index during manual rearrangement
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const enrolledIds = totalStudentsInRoom.map(s => s.id);

  // Sync / Reconcile arrangements (use gridTotalSeats as the effective grid size)
  let resolvedArrangement: (string | null)[] = [];
  if (currentRoomId) {
    const savedArr = customSeating[seatKey];
    if (savedArr) {
      let currentArr = [...savedArr];
      // Resize if grid dimensions changed
      if (currentArr.length !== gridTotalSeats) {
        const newArr = Array(gridTotalSeats).fill(null);
        for (let i = 0; i < Math.min(currentArr.length, gridTotalSeats); i++) {
          newArr[i] = currentArr[i];
        }
        currentArr = newArr;
      }
      // Keep only students who are actually enrolled here
      currentArr = currentArr.map((id) => (id && enrolledIds.includes(id) ? id : null));
      // Seat any missing enrolled students
      const missing = totalStudentsInRoom.filter((s) => !currentArr.includes(s.id));
      let missingIdx = 0;
      for (let i = 0; i < gridTotalSeats; i++) {
        if (currentArr[i] === null && missingIdx < missing.length) {
          currentArr[i] = missing[missingIdx].id;
          missingIdx++;
        }
      }
      resolvedArrangement = currentArr;
    } else {
      // Initialize layout array
      const defaultArr = Array(gridTotalSeats).fill(null);

      if (enforceGap) {
        // Group students by branch (department)
        const branchGroups: Record<string, Student[]> = {};
        totalStudentsInRoom.forEach((s) => {
          const course = getStudentCourseInSlot(s);
          const branch = course?.branch || "General Academic";
          if (!branchGroups[branch]) {
            branchGroups[branch] = [];
          }
          branchGroups[branch].push(s);
        });

        // Sort students within each branch group by ID
        Object.keys(branchGroups).forEach((bName) => {
          branchGroups[bName].sort((a, b) => a.id.localeCompare(b.id));
        });

        const activeBranches = Object.keys(branchGroups).sort();

        if (activeBranches.length > 0) {
          if (interleaveDepts && activeBranches.length > 1) {
            // Interleave departments: Column C goes to branch activeBranches[C % activeBranches.length]
            if (fillDirection === "column-wise") {
              for (let c = 0; c < numCols; c++) {
                for (let r = 0; r < numRows; r++) {
                  const idx = r * numCols + c;
                  const branchForCol = activeBranches[c % activeBranches.length];
                  const list = branchGroups[branchForCol];
                  if (list && list.length > 0) {
                    defaultArr[idx] = list.shift()!.id;
                  }
                }
              }
            } else {
              for (let r = 0; r < numRows; r++) {
                for (let c = 0; c < numCols; c++) {
                  const idx = r * numCols + c;
                  const branchForCol = activeBranches[c % activeBranches.length];
                  const list = branchGroups[branchForCol];
                  if (list && list.length > 0) {
                    defaultArr[idx] = list.shift()!.id;
                  }
                }
              }
            }
          } else {
            // Single branch, or interleaving disabled: Column 0, 2, 4... are assigned to the primary branch, Column 1, 3, 5... are empty.
            // If multiple branches are present but interleaving is disabled, we schedule them sequentially in the even columns.
            const allStudentsQueue: Student[] = [];
            activeBranches.forEach((bName) => {
              allStudentsQueue.push(...branchGroups[bName]);
            });

            if (fillDirection === "column-wise") {
              for (let c = 0; c < numCols; c++) {
                for (let r = 0; r < numRows; r++) {
                  const idx = r * numCols + c;
                  // Only assign to even columns (0, 2, 4...)
                  if (c % 2 === 0 && allStudentsQueue.length > 0) {
                    defaultArr[idx] = allStudentsQueue.shift()!.id;
                  }
                }
              }
            } else {
              for (let r = 0; r < numRows; r++) {
                for (let c = 0; c < numCols; c++) {
                  const idx = r * numCols + c;
                  // Only assign to even columns (0, 2, 4...)
                  if (c % 2 === 0 && allStudentsQueue.length > 0) {
                    defaultArr[idx] = allStudentsQueue.shift()!.id;
                  }
                }
              }
            }
          }
        }
      } else if (autoSortMode === "alt-cols" || autoSortMode === "anti-cheat") {
        // Group students by year-branch-section
        const secGroups: Record<string, Student[]> = {};
        totalStudentsInRoom.forEach((s) => {
          const course = getStudentCourseInSlot(s);
          const year = course?.year || 1;
          const branch = (s.branch || '').toUpperCase();
          const section = (s.section || '').toUpperCase();
          const key = `${year}-${branch}-${section}`;
          if (!secGroups[key]) secGroups[key] = [];
          secGroups[key].push(s);
        });

        // Sort each group alphabetically by ID
        Object.keys(secGroups).forEach((k) => {
          secGroups[k].sort((a, b) => a.id.localeCompare(b.id));
        });

        // Extract unique keys
        const uniqueKeys = Object.keys(secGroups).sort();
        
        // Separate major keys (length >= 3) from minor/leftover keys (length < 3) to keep layouts stable
        // If all keys are small, keep them all as major keys
        const hasMajor = uniqueKeys.some(k => secGroups[k].length >= 3);
        const majorKeys = hasMajor ? uniqueKeys.filter(k => secGroups[k].length >= 3) : uniqueKeys;
        const minorKeys = hasMajor ? uniqueKeys.filter(k => secGroups[k].length < 3) : [];
        
        // Interleave keys by year to ensure years alternate if multiple years are present
        const years = Array.from(new Set(majorKeys.map(k => k.split('-')[0])));
        const keysByYear: Record<string, string[]> = {};
        years.forEach(y => {
          keysByYear[y] = majorKeys.filter(k => k.startsWith(y + '-'));
        });

        const interleavedKeys: string[] = [];
        const sortedYears = years.sort();
        const maxKeysLen = Math.max(...sortedYears.map(y => keysByYear[y].length));
        
        for (let i = 0; i < maxKeysLen; i++) {
          for (const y of sortedYears) {
            if (i < keysByYear[y].length) {
              interleavedKeys.push(keysByYear[y][i]);
            }
          }
        }

        // Fill the grid using scanOrder (column-wise or row-wise)
        const scanOrder: { r: number; c: number }[] = [];
        if (fillDirection === "column-wise") {
          for (let c = 0; c < numCols; c++) {
            for (let r = 0; r < numRows; r++) {
              scanOrder.push({ r, c });
            }
          }
        } else {
          for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
              scanOrder.push({ r, c });
            }
          }
        }

        // Assign a section key to each column index
        const colKeyMap: Record<number, string> = {};
        for (let c = 0; c < numCols; c++) {
          colKeyMap[c] = interleavedKeys[c % interleavedKeys.length];
        }

        for (const { r, c } of scanOrder) {
          const idx = r * numCols + c;
          
          let targetKey = colKeyMap[c];
          
          // Pull from target group
          if (targetKey && secGroups[targetKey] && secGroups[targetKey].length > 0) {
            defaultArr[idx] = secGroups[targetKey].shift()!.id;
          }
        }

        // Fill remaining empty slots with leftovers:
        // First, collect all remaining students from the major groups and all students from minor/leftover groups.
        const leftoverStudents: Student[] = [];
        // First major remaining
        interleavedKeys.forEach(k => {
          if (secGroups[k]) {
            leftoverStudents.push(...secGroups[k]);
            secGroups[k] = [];
          }
        });
        // Then minor groups
        minorKeys.sort().forEach(k => {
          if (secGroups[k]) {
            leftoverStudents.push(...secGroups[k]);
            secGroups[k] = [];
          }
        });

        if (leftoverStudents.length > 0) {
          let leftoverIdx = 0;
          for (const { r, c } of scanOrder) {
            const idx = r * numCols + c;
            if (defaultArr[idx] === null && leftoverIdx < leftoverStudents.length) {
              defaultArr[idx] = leftoverStudents[leftoverIdx].id;
              leftoverIdx++;
            }
          }
        }
      } else if (autoSortMode === "alt-rows") {
        // Row-parallel alternating allocator
        // Group students by course ID
        const groups: Record<string, Student[]> = {};
        totalStudentsInRoom.forEach((s) => {
          const cid = getStudentCourseInSlot(s)?.id || "unknown";
          if (!groups[cid]) groups[cid] = [];
          groups[cid].push(s);
        });

        // Sort each group by Student ID
        Object.keys(groups).forEach((cid) => {
          groups[cid].sort((a, b) => a.id.localeCompare(b.id));
        });

        const sortedCourseIds = Object.keys(groups).sort();

        // Assign each row a course ID (alternating round-robin)
        const rowCourses: (string | null)[] = [];
        for (let r = 0; r < numRows; r++) {
          if (sortedCourseIds.length > 0) {
            rowCourses[r] = sortedCourseIds[r % sortedCourseIds.length];
          } else {
            rowCourses[r] = null;
          }
        }

        // Fill the grid row-by-row
        for (let r = 0; r < numRows; r++) {
          const cid = rowCourses[r];
          if (!cid) continue;
          const list = groups[cid];
          for (let c = 0; c < numCols; c++) {
            const gridIdx = r * numCols + c;
            if (list && list.length > 0) {
              const stu = list.shift()!;
              defaultArr[gridIdx] = stu.id;
            }
          }
        }

        // Fill any remaining empty slots in the grid with leftovers
        const leftoverStudents: Student[] = [];
        Object.values(groups).forEach((list) => {
          leftoverStudents.push(...list);
        });

        if (leftoverStudents.length > 0) {
          let leftoverIdx = 0;
          for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
              const gridIdx = r * numCols + c;
              if (defaultArr[gridIdx] === null && leftoverIdx < leftoverStudents.length) {
                defaultArr[gridIdx] = leftoverStudents[leftoverIdx].id;
                leftoverIdx++;
              }
            }
          }
        }
      } else {
        // Sequential / Grouped patterns
        let sorted: Student[] = [];

        if (autoSortMode === "roll-number") {
          sorted = [...totalStudentsInRoom].sort((a, b) => a.id.localeCompare(b.id));
          if (fillDirection === "column-wise") {
            sorted.forEach((stu, i) => {
              if (i < gridTotalSeats) {
                const col = Math.floor(i / numRows);
                const row = i % numRows;
                const gridIdx = row * numCols + col;
                if (gridIdx < gridTotalSeats) {
                  defaultArr[gridIdx] = stu.id;
                }
              }
            });
          } else {
            sorted.forEach((stu, i) => {
              if (i < gridTotalSeats) {
                defaultArr[i] = stu.id;
              }
            });
          }
        } else if (autoSortMode === "branch") {
          sorted = [...totalStudentsInRoom].sort((a, b) => {
            const courseA = getStudentCourseInSlot(a);
            const courseB = getStudentCourseInSlot(b);
            const branchA = courseA?.branch || "ZZZ";
            const branchB = courseB?.branch || "ZZZ";
            const cmp = branchA.localeCompare(branchB);
            if (cmp !== 0) return cmp;
            return a.id.localeCompare(b.id);
          });
          if (fillDirection === "column-wise") {
            sorted.forEach((stu, i) => {
              if (i < gridTotalSeats) {
                const col = Math.floor(i / numRows);
                const row = i % numRows;
                const gridIdx = row * numCols + col;
                if (gridIdx < gridTotalSeats) {
                  defaultArr[gridIdx] = stu.id;
                }
              }
            });
          } else {
            sorted.forEach((stu, i) => {
              if (i < gridTotalSeats) {
                defaultArr[i] = stu.id;
              }
            });
          }
        }
      }

      resolvedArrangement = defaultArr;
    }
  }

  // Swap Seats
  const handleSeatSwap = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newArr = [...resolvedArrangement];
    const temp = newArr[fromIdx];
    newArr[fromIdx] = newArr[toIdx];
    newArr[toIdx] = temp;

    const updated = {
      ...customSeating,
      [seatKey]: newArr
    };
    setCustomSeating(updated);
    localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
    setSelectedSeatIndex(null);
  };

  // Click seat
  const handleSeatClick = (index: number) => {
    if (selectedSeatIndex === null) {
      setSelectedSeatIndex(index);
    } else {
      if (selectedSeatIndex === index) {
        setSelectedSeatIndex(null);
      } else {
        handleSeatSwap(selectedSeatIndex, index);
      }
    }
  };

  // Reset to auto alternating order
  const handleResetToAuto = () => {
    if (confirm("Are you sure you want to revert this classroom's layout back to the dynamic anti-cheat alternating order? Custom drag/swap overrides will be cleared.")) {
      const updated = { ...customSeating };
      delete updated[seatKey];
      setCustomSeating(updated);
      localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
      setSelectedSeatIndex(null);
    }
  };

  // Generate Seating grid using configured numRows x numCols
  const seatingGrid: { row: number; col: number; student: Student | null; course: Course | null; isRisk: boolean }[] = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const idx = r * numCols + c;
      const studentId = resolvedArrangement[idx] ?? null;
      const stu = studentId ? students.find((s) => s.id === studentId) || null : null;
      const courseOfStudent = stu ? getStudentCourseInSlot(stu) : null;
      seatingGrid.push({ row: r + 1, col: c + 1, student: stu, course: courseOfStudent, isRisk: false });
    }
  }

  // Count unique academic years present in this room
  const uniqueYears = new Set(
    seatingGrid
      .filter((s) => s.student)
      .map((s) => getStudentYearInSlot(s.student!))
  );
  const singleYearRoom = uniqueYears.size <= 1;
  const singleExamRoom = singleYearRoom;

  // Evaluate Cheating Risk proximity warnings
  // Rule: Same-year students CAN sit in the same column (top/bottom OK).
  //       Same-year students CANNOT sit side by side (left/right = risk).
  // SKIP risk flagging entirely when only one academic year is in the room — adjacency is unavoidable.
  if (!singleYearRoom) {
    for (let i = 0; i < seatingGrid.length; i++) {
      const seat = seatingGrid[i];
      if (seat.student) {
        const row = seat.row;
        const col = seat.col;
        const sYear = getStudentYearInSlot(seat.student);

        // Only check horizontal neighbors (left & right) — same column (up/down) is allowed
        const horizontalNeighbors = [
          seatingGrid.find((s) => s.row === row && s.col === col - 1), // left
          seatingGrid.find((s) => s.row === row && s.col === col + 1), // right
        ];

        for (const edge of horizontalNeighbors) {
          if (edge && edge.student) {
            const edgeYear = getStudentYearInSlot(edge.student);
            if (edgeYear === sYear) {
              if (allowDiffBranchSecAdjacent) {
                const diffBranch = (seat.student.branch || '').toUpperCase() !== (edge.student.branch || '').toUpperCase();
                const diffSec = (seat.student.section || '').toUpperCase() !== (edge.student.section || '').toUpperCase();
                if (diffBranch || diffSec) {
                  continue;
                }
              }
              seat.isRisk = true;
              break;
            }
          }
        }
      }
    }
  }

  const riskCount = seatingGrid.filter((s) => s.isRisk).length;

  // Find assigned proctors for this classroom and slot
  const assignedInvigilatorIds = Array.from(new Set(selectedEntries.map((e) => e.invigilatorId).filter(Boolean)));
  const assignedProctors = invigilators.filter((i) => assignedInvigilatorIds.includes(i.id));

  // ── Overflow Detection ──────────────────────────────────────────────────────
  // Students who are enrolled but couldn't be placed in the grid
  const seatedStudentIds = new Set(resolvedArrangement.filter(Boolean) as string[]);
  const overflowStudents = enrolledStudents.filter((s) => !seatedStudentIds.has(s.id));

  const getRoomOccupancyInSlot = (roomId: string, slotId: string) => {
    const roomEntries = entries.filter((e) => e.timeslotId === slotId && e.roomId === roomId);
    let totalOccupancy = 0;
    
    for (const ent of roomEntries) {
      const courseEntries = entries.filter((e) => e.timeslotId === slotId && e.courseId === ent.courseId);
      const totalStudents = students.filter((s) => s.courses.some(c => c.trim().toUpperCase() === ent.courseId.trim().toUpperCase())).length;
      let enrolled = totalStudents;
      
      if (courseEntries.length > 1) {
        const roomsWithCap = courseEntries.map((e) => {
          const r = rooms.find((rm) => rm.id === e.roomId);
          return {
            id: e.id,
            roomId: e.roomId,
            capacity: r?.capacity || 30,
          };
        }).sort((a, b) => b.capacity - a.capacity);
        
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
      totalOccupancy += enrolled;
    }
    
    // Add overflow arrivals
    const arrivals = overflowAssignments
      .filter((a) => a.slotId === slotId && a.toRoomId === roomId)
      .reduce((sum, a) => sum + a.studentIds.length, 0);
    totalOccupancy += arrivals;
    
    return totalOccupancy;
  };

  // All other rooms in the system (exclude current room and fully occupied rooms)
  const overflowTargetRooms = rooms.filter((r) => {
    if (r.id === currentRoomId) return false;
    const occupancy = getRoomOccupancyInSlot(r.id, selectedSlotId);
    return occupancy < r.capacity;
  });

  // Existing overflow assignment originating from this room+slot
  const currentOverflowAssignment = overflowAssignments.find(
    (a) => a.slotId === selectedSlotId && a.fromRoomId === currentRoomId
  );

  // Students overflowed FROM another room INTO the currently viewed room
  const overflowArrivals: { student: Student; fromRoom: Room | undefined; course: Course | null }[] = 
    overflowAssignments
      .filter((a) => a.slotId === selectedSlotId && a.toRoomId === currentRoomId)
      .flatMap((a) =>
        a.studentIds
          .map((id) => students.find((s) => s.id === id))
          .filter(Boolean)
          .map((stu) => {
            const fromRoom = rooms.find((r) => r.id === a.fromRoomId);
            const courseId = stu!.courses.find((cid) =>
              entries.some(
                (e) => e.courseId === cid && e.timeslotId === selectedSlotId && e.roomId === a.fromRoomId
              )
            );
            const course = courseId ? courses.find((c) => c.id === courseId) || null : null;
            return { student: stu!, fromRoom, course };
          })
      );

  const handleAssignOverflow = () => {
    if (!selectedOverflowTargetRoom || overflowStudents.length === 0) return;
    const newAssignment: OverflowAssignment = {
      slotId: selectedSlotId,
      fromRoomId: currentRoomId,
      toRoomId: selectedOverflowTargetRoom,
      studentIds: overflowStudents.map((s) => s.id),
    };
    // Replace any existing assignment for this room+slot
    const updated = [
      ...overflowAssignments.filter(
        (a) => !(a.slotId === selectedSlotId && a.fromRoomId === currentRoomId)
      ),
      newAssignment,
    ];
    setOverflowAssignments(updated);
    localStorage.setItem("exam_scheduler_overflow_assignments", JSON.stringify(updated));
    setSelectedOverflowTargetRoom("");
  };

  const handleClearOverflowAssignment = () => {
    const updated = overflowAssignments.filter(
      (a) => !(a.slotId === selectedSlotId && a.fromRoomId === currentRoomId)
    );
    setOverflowAssignments(updated);
    localStorage.setItem("exam_scheduler_overflow_assignments", JSON.stringify(updated));
  };

  // Automatically sync / clear overflow assignment if students fit now (due to layout / grid changes)
  useEffect(() => {
    if (!selectedSlotId || !currentRoomId) return;

    const currentOverflowIds = overflowStudents.map((s) => s.id).sort();

    setOverflowAssignments((prev) => {
      const currentAssignment = prev.find(
        (a) => a.slotId === selectedSlotId && a.fromRoomId === currentRoomId
      );
      if (!currentAssignment) return prev;

      const savedIds = [...currentAssignment.studentIds].sort();
      const isDifferent = 
        currentOverflowIds.length !== savedIds.length ||
        currentOverflowIds.some((id, idx) => id !== savedIds[idx]);

      if (!isDifferent) return prev;

      let updated;
      if (currentOverflowIds.length === 0) {
        updated = prev.filter(
          (a) => !(a.slotId === selectedSlotId && a.fromRoomId === currentRoomId)
        );
      } else {
        updated = prev.map((a) => {
          if (a.slotId === selectedSlotId && a.fromRoomId === currentRoomId) {
            return { ...a, studentIds: currentOverflowIds };
          }
          return a;
        });
      }

      localStorage.setItem("exam_scheduler_overflow_assignments", JSON.stringify(updated));
      return updated;
    });
  }, [selectedSlotId, currentRoomId, overflowStudents]);

  const handleSendSeatingPlan = async () => {
    if (assignedProctors.length === 0) {
      alert("No proctors are currently assigned to this classroom for this slot. Please assign a proctor in the Optimizer Calendar first.");
      return;
    }

    const proctorsWithoutEmail = assignedProctors.filter(p => !p.email);
    if (proctorsWithoutEmail.length > 0) {
      alert(`The following assigned proctors do not have an email address configured: ${proctorsWithoutEmail.map(p => p.name).join(", ")}. Please configure emails in Settings > Database Config.`);
      return;
    }

    setSendingPlan(true);
    setSendSuccessMessage(null);
    try {
      const timeslotLabel = getTimeslotExact(selectedSlotId, examStartDate);
      const roomLabel = `${roomObj?.name} (${roomObj?.building}${roomObj?.block ? ` - ${roomObj.block}` : ""})`;
      const seatingGridPayload = seatingGrid.map(s => ({
        row: s.row,
        col: s.col,
        student: s.student ? { name: s.student.name, id: s.student.id, email: (s.student as any).email, accommodations: s.student.accommodations, branch: (s.student as any).branch, section: (s.student as any).section } : null,
        course: s.course ? { id: s.course.id, name: s.course.name, branch: s.course.branch } : null,
        isRisk: s.isRisk
      }));

      // 1. Send seating plan to each assigned proctor
      const proctorPromises = assignedProctors.map(proctor => 
        api.sendSeatingPlan({
          invigilatorId: proctor.id,
          timeslotId: selectedSlotId,
          roomId: currentRoomId,
          timeslotLabel,
          roomLabel,
          seatingGrid: seatingGridPayload,
          riskCount,
          singleExamRoom
        })
      );

      // 2. Send individual seat notifications to students
      const studentNotifyPromise = api.sendStudentSeatNotifications({
        timeslotLabel,
        roomLabel,
        collegeName,
        seatingGrid: seatingGridPayload,
        singleExamRoom
      });

      const [proctorResults, studentResult] = await Promise.all([
        Promise.all(proctorPromises),
        studentNotifyPromise.catch(err => ({ message: `Student notifications failed: ${err.message}`, sentCount: 0, failedCount: 0 }))
      ]);

      const url = proctorResults.find(r => r.url)?.url;
      
      let msg = `Seating plan successfully emailed to ${assignedProctors.map(p => p.name).join(", ")}!`;
      if ((studentResult as any).sentCount > 0) {
        msg += ` Student seat confirmations sent to ${(studentResult as any).sentCount} student${(studentResult as any).sentCount !== 1 ? 's' : ''}.`;
      } else if ((studentResult as any).failedCount === 0 && (studentResult as any).sentCount === 0) {
        msg += ` (No students with email addresses found for seat notifications.)`;
      }
      if (url) {
        msg += ` (Ethereal test mailbox created. Preview URL: ${url})`;
      }
      setSendSuccessMessage(msg);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to send seating plan: ${err.message || err}`);
    } finally {
      setSendingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      {sendSuccessMessage && (
        <div className="bg-emerald-950/40 border border-emerald-900/40 p-4 rounded-xl text-emerald-400 text-xs flex items-center justify-between shadow-md">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              {sendSuccessMessage.replace(/ \((Ethereal test mailbox created\. Preview URL: .*)\)$/, "")}
            </span>
          </span>
          {(() => {
            const match = sendSuccessMessage.match(/Preview URL:\s*([^\s)]+)/);
            if (match) {
              return (
                <a 
                  href={match[1]} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shrink-0 ml-4 cursor-pointer"
                >
                  Open Email Preview ↗
                </a>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Selector Matrix Banner */}
      <div className="print:hidden bg-[#12151C] p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white">Seating Plan & Cheating-Risk Inspector</h2>
              <button 
                onClick={() => window.print()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition shadow-[0_0_10px_rgba(79,70,229,0.3)] cursor-pointer"
                title="Print this layout as a PDF to tape on the classroom door"
              >
                <Printer className="w-3.5 h-3.5" /> Export PDF
              </button>

              {currentRoomId && (
                <button
                  onClick={handleSendSeatingPlan}
                  disabled={sendingPlan}
                  className={`px-3 py-1 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                    sendingPlan 
                      ? "bg-slate-800 border border-slate-700/60 text-slate-400 cursor-not-allowed" 
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  }`}
                  title={
                    assignedProctors.length > 0 
                      ? `Send this seating plan layout to the assigned proctor(s): ${assignedProctors.map(p => p.name).join(", ")}` 
                      : "No proctor is currently assigned to this classroom"
                  }
                >
                  {sendingPlan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  {sendingPlan ? "Sending..." : "Email Seating Plan"}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Inspect seating arrangements per exam block, validating wheelchair access matches and anti-cheat proximity limits.
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex-grow md:flex-initial">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Timeslot</label>
              <select
                value={selectedSlotId}
                onChange={(e) => {
                  setSelectedSlotId(e.target.value);
                  setSelectedRoomId(""); // Auto re-detect room
                }}
                className="px-3 py-2 bg-[#0A0C10] border border-slate-700 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 w-full"
              >
                {DEFAULT_TIMESLOTS.map((ts) => (
                  <option key={ts.id} value={ts.id} className="bg-[#12151C] text-slate-200">
                    {getTimeslotExact(ts.id, examStartDate)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-grow md:flex-initial">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Exam Room</label>
              <select
                value={currentRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="px-3 py-2 bg-[#0A0C10] border border-slate-700 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 w-full disabled:opacity-50"
                disabled={activeRooms.length === 0}
              >
                {activeRooms.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#12151C] text-slate-200">
                    {r.name} ({r.building}{r.block ? ` - ${r.block}` : ""})
                  </option>
                ))}
                {activeRooms.length === 0 && <option value="">No Active rooms in this timeslot</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Grid Layout Configuration Row */}
        {currentRoomId && (
          <div className="border-t border-slate-800/60 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
              Classroom Layout Configuration
              <span className="ml-1 text-slate-600 font-normal normal-case tracking-normal">— customise grid dimensions for {roomObj?.name}</span>
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              {/* Number of Rows */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. of Rows</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateGridConfig({ numRows: Math.max(1, numRows - 1), seatsPerCol: Math.max(1, numRows - 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numRows}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                      updateGridConfig({ numRows: v, seatsPerCol: v });
                    }}
                    className="w-14 px-2 py-1.5 text-center bg-[#0A0C10] border border-slate-700 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                  />
                  <button
                    onClick={() => updateGridConfig({ numRows: Math.min(50, numRows + 1), seatsPerCol: Math.min(50, numRows + 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >+</button>
                </div>
              </div>

              {/* Divider */}
              <div className="text-slate-700 text-lg font-light self-center pb-0.5">×</div>

              {/* Number of Columns */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. of Columns</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateGridConfig({ numCols: Math.max(1, numCols - 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={numCols}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                      updateGridConfig({ numCols: v });
                    }}
                    className="w-14 px-2 py-1.5 text-center bg-[#0A0C10] border border-slate-700 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                  />
                  <button
                    onClick={() => updateGridConfig({ numCols: Math.min(20, numCols + 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >+</button>
                </div>
              </div>

              {/* Divider */}
              <div className="text-slate-700 text-lg font-light self-center pb-0.5">=</div>

              {/* Seats per Column (display-only, mirrors numRows) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seats per Column</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateGridConfig({ numRows: Math.max(1, numRows - 1), seatsPerCol: Math.max(1, numRows - 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={seatsPerCol}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                      updateGridConfig({ numRows: v, seatsPerCol: v });
                    }}
                    className="w-14 px-2 py-1.5 text-center bg-[#0A0C10] border border-slate-700 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                  />
                  <button
                    onClick={() => updateGridConfig({ numRows: Math.min(50, numRows + 1), seatsPerCol: Math.min(50, numRows + 1) })}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
                  >+</button>
                </div>
              </div>

              {/* Sort Mode */}
              <div className="flex flex-col gap-1 ml-4 border-l border-slate-800/80 pl-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auto-Fill Pattern</label>
                <select
                  value={autoSortMode}
                  disabled={enforceGap}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setAutoSortMode(val);
                    localStorage.setItem("exam_scheduler_autosort_mode_v2", val);
                    // Clear custom overrides to trigger auto-sort update immediately
                    const updated = { ...customSeating };
                    delete updated[seatKey];
                    setCustomSeating(updated);
                    localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
                    setSelectedSeatIndex(null);
                  }}
                  className="px-3 py-1.5 bg-[#0A0C10] border border-slate-700 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 cursor-pointer disabled:opacity-40"
                >
                  <option value="anti-cheat">Interleaved Anti-Cheat</option>
                  <option value="alt-cols">Alternate Columns</option>
                  <option value="alt-rows">Alternate Rows</option>
                  <option value="roll-number">Sequential (Roll Number)</option>
                  <option value="branch">Grouped by Branch</option>
                </select>
              </div>

              {/* Column Gap Constraints */}
              <div className="flex flex-col gap-1 ml-4 border-l border-slate-800/80 pl-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anti-Cheat Column Gaps</label>
                <div className="flex flex-col gap-1 mt-0.5">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enforceGap}
                      onChange={(e) => handleEnforceGapChange(e.target.checked)}
                      className="accent-indigo-500 rounded cursor-pointer"
                    />
                    <span>Strict 1-Col Gap</span>
                  </label>
                  <label className={`flex items-center gap-2 text-xs cursor-pointer select-none transition ${enforceGap ? "text-slate-200" : "text-slate-500 pointer-events-none"}`}>
                    <input
                      type="checkbox"
                      checked={interleaveDepts}
                      disabled={!enforceGap}
                      onChange={(e) => handleInterleaveDeptsChange(e.target.checked)}
                      className="accent-indigo-500 rounded cursor-pointer disabled:opacity-40"
                    />
                    <span>Interleave Depts</span>
                  </label>
                </div>
              </div>

              {/* Branch/Section Adjacency Option */}
              <div className="flex flex-col gap-1 ml-4 border-l border-slate-800/80 pl-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Same-Course Exceptions</label>
                <div className="flex flex-col gap-1 mt-0.5">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none" title="Allows same-course students from different branches or different sections to sit horizontally adjacent.">
                    <input
                      type="checkbox"
                      checked={allowDiffBranchSecAdjacent}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAllowDiffBranchSecAdjacent(val);
                        localStorage.setItem("exam_scheduler_allow_diff_branch_sec_adjacent", String(val));
                        // Clear custom overrides to trigger auto-sort update immediately
                        const updated = { ...customSeating };
                        delete updated[seatKey];
                        setCustomSeating(updated);
                        localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
                        setSelectedSeatIndex(null);
                      }}
                      className="accent-indigo-500 rounded cursor-pointer"
                    />
                    <span>Allow Diff Branch/Sec</span>
                  </label>
                </div>
              </div>

              {/* Seating Flow Direction */}
              <div className="flex flex-col gap-1 ml-4 border-l border-slate-800/80 pl-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arrangement Flow</label>
                <select
                  value={fillDirection}
                  disabled={autoSortMode === "alt-cols" || autoSortMode === "alt-rows"}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFillDirection(val);
                    localStorage.setItem("exam_scheduler_fill_direction_v2", val);
                    // Clear custom overrides to trigger auto-sort update immediately
                    const updated = { ...customSeating };
                    delete updated[seatKey];
                    setCustomSeating(updated);
                    localStorage.setItem("exam_scheduler_custom_seating", JSON.stringify(updated));
                    setSelectedSeatIndex(null);
                  }}
                  className="px-3 py-1.5 bg-[#0A0C10] border border-slate-700 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 cursor-pointer disabled:opacity-40"
                >
                  <option value="row-wise">Row-wise (Horizontal)</option>
                  <option value="column-wise">Column-wise (Vertical)</option>
                </select>
              </div>

              {/* Summary Badge */}
              <div className="ml-2 px-4 py-2 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Grid Total</span>
                <span className="text-lg font-extrabold text-white">{gridTotalSeats}</span>
                <span className="text-[9px] text-indigo-400">{numRows} rows × {numCols} cols</span>
              </div>

              {/* Capacity warning */}
              {gridTotalSeats < enrolledStudents.length && (
                <div className="ml-2 px-3 py-2 rounded-xl bg-red-950/30 border border-red-900/40 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-red-400">⚠ Grid too small — {enrolledStudents.length - gridTotalSeats} student(s) won't fit. Scroll down to assign overflow to another room.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {currentRoomId ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual Seating Map */}
          <div className="lg:col-span-2 bg-[#12151C] print:bg-white print:border-slate-300 p-6 print:p-0 rounded-2xl border border-slate-800 space-y-6 print:space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 print:border-slate-300 pb-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 print:text-slate-800 uppercase tracking-widest">Floor Plan Grid Matrix</h3>
                <p className="text-[11px] text-slate-400 print:text-slate-600 mt-1">
                  Active Room: <span className="font-bold text-white print:text-black">{roomObj?.name}</span> ({roomObj?.building}{roomObj?.block ? ` - ${roomObj.block}` : ""}) | Total Seats: <span className="font-bold text-slate-200 print:text-slate-800">{roomObj?.capacity}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                {customSeating[seatKey] && (
                  <button
                    onClick={handleResetToAuto}
                    className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 border border-slate-700/60 rounded-md transition flex items-center gap-1 cursor-pointer"
                    title="Clear override & restore auto alternating order"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Seating
                  </button>
                )}
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  singleYearRoom
                    ? "bg-blue-950/40 text-blue-400 border border-blue-900/30"
                    : riskCount > 0
                    ? "bg-amber-950/40 text-amber-400 border border-amber-900/30"
                    : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                }`}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {singleYearRoom
                    ? `Single-year room — all students belong to academic year ${uniqueYears.size > 0 ? [...uniqueYears][0] : ""}. Horizontal adjacency unavoidable; no anti-cheat risk flagged.`
                    : riskCount > 0
                    ? `${riskCount} seat(s) have same-year students side-by-side (horizontal risk)`
                    : "No side-by-side same-year risk — column sharing is permitted"}
                </span>
              </div>
            </div>

            {/* Front Stage Indicator */}
            <div className="w-full bg-[#0A0C10] text-slate-400 py-2 border border-slate-800 rounded-lg text-center font-bold text-[10px] uppercase tracking-widest">
              🏫 Examination Board Platform / Proctor Desk
            </div>

            {/* Manual Edit Guide Callout */}
            <div className="print:hidden p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl flex items-start gap-2.5 text-[11px] text-indigo-300">
              <Move className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <div>
                <span className="font-bold">Manual Placement Guide:</span> Drag and drop students to rearrange, or simply click a seat to select it (it will glow), then click on another seat to swap them. Keep an eye on the realtime proximity risk indicator!
              </div>
            </div>

            {/* Seating Grid Map Layout */}
            <div
              className="grid gap-3.5 pt-4"
              style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
            >
              {seatingGrid.map((seat, i) => {
                const isSelected = selectedSeatIndex === i;
                return (
                  <div
                    key={i}
                    draggable={seat.student !== null}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", i.toString());
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"));
                      if (!isNaN(sourceIdx)) {
                        handleSeatSwap(sourceIdx, i);
                      }
                    }}
                    onClick={() => handleSeatClick(i)}
                    className={`relative p-3.5 rounded-xl border flex flex-col justify-between items-center text-center transition min-h-[90px] print:min-h-[70px] print:break-inside-avoid cursor-pointer hover:scale-[1.02] transform select-none ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.35)] print:bg-indigo-100 print:border-indigo-500"
                        : !seat.student
                        ? "bg-[#0A0C10]/40 border-dashed border-slate-850 text-slate-500 hover:border-slate-700 hover:bg-[#0A0C10]/60 print:bg-slate-50 print:border-slate-300 print:text-slate-400"
                        : seat.isRisk && !singleYearRoom
                        ? "bg-amber-950/30 border-amber-850 text-amber-300 shadow-lg hover:border-amber-700 print:bg-amber-50 print:border-amber-400 print:text-amber-800"
                        : "bg-[#12151C] border-slate-850 text-slate-200 hover:border-slate-700 hover:bg-[#12151C]/60 print:bg-white print:border-slate-300 print:text-slate-800"
                    }`}
                  >
                    <span className="absolute top-1 right-1.5 text-[8px] text-slate-500 font-mono">Row {seat.row}-{seat.col}</span>
                    
                    {seat.student ? (
                      <>
                        <div className="space-y-1 mt-2.5">
                          <Users className={`w-5 h-5 mx-auto ${isSelected ? "text-indigo-400 animate-pulse" : (seat.isRisk && !singleYearRoom) ? "text-amber-400 print:text-amber-600" : "text-blue-400 print:text-blue-600"}`} />
                          <h5 className="text-[10px] font-bold truncate max-w-[80px] print:text-slate-900" title={seat.student.name}>
                            {seat.student.name}
                          </h5>
                          <p className="text-[9px] font-mono font-bold text-slate-400 print:text-slate-600">
                            {seat.student.id}
                            {((seat.student as any).branch || (seat.student as any).section) ? ` [${(seat.student as any).branch || ""}${(seat.student as any).section ? `-${(seat.student as any).section}` : ""}]` : ""}
                          </p>
                        </div>

                        {/* Course badge */}
                        <div className="mt-2 text-[8px] bg-blue-950 print:bg-blue-100 print:border-blue-300 print:text-blue-800 border border-blue-900/80 text-blue-300 font-bold font-mono px-1 py-0.2 rounded truncate max-w-[85px] uppercase" title={seat.course?.branch ? `Branch: ${seat.course.branch}` : undefined}>
                          {seat.course?.id} {seat.course?.branch ? `(${seat.course.branch})` : ""}
                        </div>

                        {/* Proximity Risk badge — only shown when there are multiple academic years and a real risk exists */}
                        {seat.isRisk && !singleYearRoom && (
                          <span className="absolute bottom-1 right-1 bg-amber-500 text-white rounded-full p-0.5" title="Adjacent seating of same academic year can facilitate cheating! Consider swapping timeslots or rooms.">
                            <AlertTriangle className="w-2.5 h-2.5 text-[#12151C] fill-[#12151C]" />
                          </span>
                        )}

                        {/* Accommodation badge */}
                        {seat.student.accommodations.length > 0 && (
                          <span className="absolute top-1 left-1.5 text-[9px]" title={`Accommodated: ${seat.student.accommodations.join(", ")}`}>
                            {seat.student.accommodations.includes("accessible") ? "♿" : "⏱️"}
                          </span>
                        )}

                        {/* Selected Indicator */}
                        {isSelected && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-500 text-white rounded px-1 text-[8px] font-extrabold uppercase py-0.2 tracking-wider transform translate-y-1">
                            Selected
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="my-auto py-2.5">
                        <p className="text-[10px] font-medium text-slate-500">Empty Seat</p>
                        {isSelected && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-500 text-white rounded px-1 text-[8px] font-extrabold uppercase py-0.2 tracking-wider transform translate-y-1">
                            Selected
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid Map Legend */}
            <div className="print:hidden flex flex-col md:flex-row border-t border-slate-800 pt-4 gap-4 justify-center items-center text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#12151C] border border-slate-850 inline-block"></span> Candidate seated safe</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-950/30 border border-amber-800/80 inline-block"></span> Same-year students side-by-side (horizontal risk only)</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-950/20 border border-emerald-900/40 inline-block"></span> Same column OK — vertical sharing allowed</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#0A0C10]/40 border border-dashed border-slate-800 inline-block"></span> Unassigned / Open Cushion Space</span>
            </div>
          </div>

          {/* ── Overflow Students Assignment Panel ── */}
          {overflowStudents.length > 0 && (
            <div className="print:hidden lg:col-span-3 bg-[#12151C] border border-red-900/50 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex items-center gap-2 border-b border-red-900/30 pb-3">
                <ArrowRightCircle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-red-300 uppercase tracking-widest">Overflow Students — Room Too Small</h3>
                  <p className="text-[10px] text-red-400/70 mt-0.5">
                    {overflowStudents.length} student{overflowStudents.length > 1 ? "s" : ""} couldn't be placed in this room's grid. Select another room in the same timeslot to reassign them.
                  </p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-4">
                {/* Overflow student list */}
                <div className="flex-1 space-y-1.5 max-h-48 overflow-y-auto">
                  {overflowStudents.map((stu) => {
                    const course = getStudentCourseInSlot(stu);
                    return (
                      <div key={stu.id} className="flex items-center justify-between px-3 py-2 bg-red-950/20 border border-red-900/30 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-red-200">{stu.name}</p>
                          <p className="text-[10px] font-mono text-red-400">{stu.id}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold bg-red-950 border border-red-900/60 text-red-300 px-2 py-0.5 rounded font-mono">{course?.id || "—"}</span>
                          {stu.accommodations.length > 0 && <p className="text-[9px] text-amber-400 mt-0.5">⏱️ Accommodated</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Assignment controls */}
                <div className="lg:w-80 flex flex-col justify-center gap-3">
                  {currentOverflowAssignment ? (
                    <div className="flex items-center justify-between gap-3 p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
                      <div className="text-xs">
                        <p className="font-bold text-emerald-300">✓ Overflow assigned</p>
                        <p className="text-[10px] text-emerald-400 mt-1">
                          {overflowStudents.length} student{overflowStudents.length > 1 ? "s" : ""} →{" "}
                          <span className="font-bold">{rooms.find((r) => r.id === currentOverflowAssignment.toRoomId)?.name || currentOverflowAssignment.toRoomId}</span>
                        </p>
                        <p className="text-[9px] text-emerald-500 mt-0.5">
                          Switch to that room to see them listed as Overflow Arrivals.
                        </p>
                      </div>
                      <button
                        onClick={handleClearOverflowAssignment}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 border border-rose-900/40 bg-rose-950/30 hover:bg-rose-950/50 px-3 py-2 rounded-lg transition cursor-pointer shrink-0"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] text-slate-400">Pick a room in <span className="font-bold text-white">{getTimeslotExact(selectedSlotId, examStartDate)}</span> to send the overflow students to:</p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedOverflowTargetRoom}
                            onChange={(e) => setSelectedOverflowTargetRoom(e.target.value)}
                            className="flex-grow px-3 py-2 bg-[#0A0C10] border border-slate-700 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-200"
                          >
                            <option value="">Select target room…</option>
                            {overflowTargetRooms.map((r) => {
                              const isAssigned = activeEntries.some((e) => e.roomId === r.id);
                              return (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.building}{r.block ? ` - ${r.block}` : ""}) — cap {r.capacity} {isAssigned ? "(Active)" : "(Free)"}
                                </option>
                              );
                            })}
                            {overflowTargetRooms.length === 0 && (
                              <option disabled>No other available rooms in system</option>
                            )}
                          </select>
                          <button
                            onClick={handleAssignOverflow}
                            disabled={!selectedOverflowTargetRoom}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
                          >
                            Assign →
                          </button>
                        </div>
                        
                        <button
                          onClick={() => {
                            localStorage.setItem("exam_scheduler_focus_add_room", "true");
                            if (setActiveTab) setActiveTab("config");
                          }}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none"
                        >
                          + Configure / Add New Room
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}


          <div className="print:hidden bg-[#12151C] p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Enrolled Proctor Log</h3>
            <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-1">
              <p className="text-xs font-bold text-blue-300">🛡️ Strict Anti-Cheat Guarantee</p>
              <p className="text-[11px] text-blue-400 leading-normal">
                Same-year students may share a <span className="font-bold text-blue-300">column</span> (vertically, top/bottom — OK). The layout engine <span className="font-bold text-emerald-300">strictly prevents</span> same-year students from sitting <span className="font-bold text-amber-300">side by side</span> horizontally, even when course sizes are unequal.
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Candidate check-ins ({enrolledStudents.length})
                {overflowStudents.length > 0 && (
                  <span className="ml-2 text-red-400">· {overflowStudents.length} overflow</span>
                )}
              </span>
              {enrolledStudents.map((stu) => {
                const isOverflow = overflowStudents.some((o) => o.id === stu.id);
                return (
                  <div key={stu.id} className={`p-2.5 rounded-lg border hover:bg-slate-900/30 flex items-center justify-between text-xs transition ${
                    isOverflow ? "border-red-900/40 bg-red-950/10" : "border-slate-850"
                  }`}>
                    <div className="space-y-0.5">
                      <p className={`font-bold ${isOverflow ? "text-red-300" : "text-slate-200"}`}>{stu.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        ID: {stu.id} {stu.branch ? `| Branch: ${stu.branch}` : ""} {stu.section ? `| Sec: ${stu.section}` : ""}
                      </p>
                      {isOverflow && <p className="text-[9px] text-red-400 font-semibold">⚠ Overflow — not in grid</p>}
                    </div>
                    <div className="text-right space-y-1">
                      <span className={`px-2 py-0.5 rounded border font-mono text-[9px] font-semibold ${
                        isOverflow ? "bg-red-950 border-red-900/40 text-red-300" : "bg-sky-950 border-sky-900/40 text-sky-400"
                      }`}>
                        {getStudentCourseInSlot(stu)?.id || "—"}
                        {getStudentCourseInSlot(stu)?.branch ? ` • ${getStudentCourseInSlot(stu)?.branch}` : ""}
                      </span>
                      {stu.accommodations.length > 0 && (
                        <p className="text-[9px] font-semibold text-amber-400">⏱️ Accommodated</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {enrolledStudents.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-xs text-slate-500 italic">No students allocated in this Room + Timeslot block</p>
                </div>
              )}
            </div>

            {/* ── Overflow Arrivals from other rooms ── */}
            {overflowArrivals.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <LogIn className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
                    Overflow Arrivals ({overflowArrivals.length})
                  </span>
                </div>
                <p className="text-[10px] text-violet-400/70 leading-normal">
                  These students couldn't fit in their original room and have been reassigned here.
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {overflowArrivals.map(({ student, fromRoom, course }) => (
                    <div key={student.id} className="p-2.5 rounded-lg border border-violet-900/40 bg-violet-950/20 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-violet-200">{student.name}</p>
                        <p className="text-[10px] font-mono text-violet-400">ID: {student.id}</p>
                        <p className="text-[9px] text-violet-400/60">
                          from {fromRoom?.name || "another room"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-violet-950 border border-violet-900/40 text-violet-300 font-mono text-[9px] font-semibold">
                        {course?.id || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#12151C] p-12 text-center border border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-500 italic">Please select an active examination slot to view seating planner</p>
        </div>
      )}
    </div>
  );
}
