import { Course, Room, Student, Invigilator, ScheduleEntry, ConflictReport } from "../../src/types";
import { getConflictReport, buildEnrollmentIndex, getCourseEnrollment } from "../solver";
import { 
  getAllCourses, 
  getAllRooms, 
  getAllStudents, 
  getAllInvigilators, 
  getAllScheduleEntries 
} from "../db";

export interface ProposalValidationResult {
  valid: boolean;
  errors: string[];
  originalConflictsCount: number;
  newConflictsCount: number;
  newConflicts: ConflictReport[];
}

export async function validateProposal(modifications: any[]): Promise<ProposalValidationResult> {
  const [courses, rooms, students, invigilators, entries] = await Promise.all([
    getAllCourses(),
    getAllRooms(),
    getAllStudents(),
    getAllInvigilators(),
    getAllScheduleEntries(),
  ]);

  const errors: string[] = [];

  // 1. Validate that modifications array is structured correctly
  if (!Array.isArray(modifications)) {
    return {
      valid: false,
      errors: ["Invalid proposal format: modifications must be an array."],
      originalConflictsCount: 0,
      newConflictsCount: 0,
      newConflicts: []
    };
  }

  // 2. Validate IDs
  for (const mod of modifications) {
    if (!mod.entryId) {
      errors.push("Missing entryId in modification.");
      continue;
    }
    const entryExists = entries.some(e => e.id === mod.entryId);
    if (!entryExists) {
      errors.push(`Invalid entryId: "${mod.entryId}" does not exist.`);
    }

    if (mod.roomId) {
      const roomExists = rooms.some(r => r.id === mod.roomId);
      if (!roomExists) {
        errors.push(`Invalid roomId: "${mod.roomId}" does not exist.`);
      }
    }

    if (mod.invigilatorId) {
      const invigIds = mod.invigilatorId.split(",").map((id: string) => id.trim()).filter(Boolean);
      for (const invId of invigIds) {
        const invigExists = invigilators.some(i => i.id === invId);
        if (!invigExists) {
          errors.push(`Invalid invigilatorId: "${invId}" does not exist.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      originalConflictsCount: 0,
      newConflictsCount: 0,
      newConflicts: []
    };
  }

  // Calculate original conflicts
  const originalConflicts = getConflictReport(entries, courses, students, rooms, invigilators);

  // 3. Virtual scheduling - apply modifications to a clone
  const virtualEntries = entries.map(e => ({ ...e }));
  for (const mod of modifications) {
    const entry = virtualEntries.find(e => e.id === mod.entryId);
    if (entry) {
      if (mod.timeslotId !== undefined) entry.timeslotId = mod.timeslotId;
      if (mod.roomId !== undefined) entry.roomId = mod.roomId;
      if (mod.invigilatorId !== undefined) entry.invigilatorId = mod.invigilatorId;
    }
  }

  // 4. Run conflict checks on virtual entries
  const virtualConflicts = getConflictReport(virtualEntries, courses, students, rooms, invigilators);
  const newHardConflicts = virtualConflicts.filter(c => c.type === "Hard");

  // Validate Proctor Availability
  const eIdx = buildEnrollmentIndex(students);

  // Partition student enrollment counts for virtual entries in each slot
  const studentCountInRoomMap = new Map<string, number>();
  const entriesBySlot = new Map<string, typeof virtualEntries>();
  virtualEntries.forEach(e => {
    if (e.timeslotId && e.roomId) {
      const list = entriesBySlot.get(e.timeslotId) || [];
      list.push(e);
      entriesBySlot.set(e.timeslotId, list);
    }
  });

  for (const [slotId, slotList] of entriesBySlot.entries()) {
    const courseEntriesMap = new Map<string, typeof virtualEntries>();
    for (const ent of slotList) {
      const list = courseEntriesMap.get(ent.courseId) || [];
      list.push(ent);
      courseEntriesMap.set(ent.courseId, list);
    }
    
    for (const [cId, courseEntries] of courseEntriesMap.entries()) {
      const courseStudents = getCourseEnrollment(cId, students, eIdx);
      if (courseEntries.length === 1) {
        studentCountInRoomMap.set(courseEntries[0].id, courseStudents.length);
      } else {
        const roomsWithCap = courseEntries.map(e => {
          const r = rooms.find(rm => rm.id === e.roomId);
          return {
            entryId: e.id,
            capacity: r?.capacity || 30
          };
        });
        
        let assigned = 0;
        roomsWithCap.forEach(item => {
          let share = Math.min(item.capacity, courseStudents.length - assigned);
          studentCountInRoomMap.set(item.entryId, share);
          assigned += share;
        });
      }
    }
  }

  for (const mod of modifications) {
    if (mod.invigilatorId && mod.timeslotId) {
      const invIds = mod.invigilatorId.split(",").map((id: string) => id.trim()).filter(Boolean);
      for (const invId of invIds) {
        const inv = invigilators.find(i => i.id === invId);
        if (inv && !inv.availability.includes(mod.timeslotId)) {
          errors.push(`Invigilator "${inv.name}" is not available in timeslot [${mod.timeslotId}].`);
        }
      }
    }

    // Validate Room Capacity
    if (mod.roomId && mod.timeslotId) {
      const room = rooms.find(r => r.id === mod.roomId);
      if (room) {
        const slotEntries = virtualEntries.filter(e => e.timeslotId === mod.timeslotId && e.roomId === mod.roomId);
        const totalEnrolled = slotEntries.reduce((sum, e) => sum + (studentCountInRoomMap.get(e.id) || 0), 0);
        if (totalEnrolled > room.capacity) {
          errors.push(`Room "${room.name}" exceeds capacity limit: ${totalEnrolled} enrolled vs ${room.capacity} seats.`);
        }
      }
    }
  }

  // If there are newly introduced hard conflicts or specific errors, mark as invalid
  const newHardCount = newHardConflicts.length;
  const originalHardCount = originalConflicts.filter(c => c.type === "Hard").length;

  // Let's check if the number of hard conflicts increased
  if (newHardCount > originalHardCount) {
    errors.push(`Proposal increases hard conflicts count from ${originalHardCount} to ${newHardCount}.`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      originalConflictsCount: originalConflicts.length,
      newConflictsCount: virtualConflicts.length,
      newConflicts: virtualConflicts
    };
  }

  return {
    valid: true,
    errors: [],
    originalConflictsCount: originalConflicts.length,
    newConflictsCount: virtualConflicts.length,
    newConflicts: virtualConflicts
  };
}
