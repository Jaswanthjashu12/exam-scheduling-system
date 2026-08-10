import Database from 'better-sqlite3';

const db = new Database('data/exam_scheduler.db');
const entries = db.prepare("SELECT * FROM schedule_entries").all() as any[];
const rooms = db.prepare("SELECT * FROM rooms").all() as any[];
const rawStudents = db.prepare("SELECT * FROM students").all() as any[];
const studentCourses = db.prepare("SELECT * FROM student_courses").all() as any[];

const coursesMap: Record<string, string[]> = {};
for (const c of studentCourses) {
  if (!coursesMap[c.student_id]) coursesMap[c.student_id] = [];
  coursesMap[c.student_id].push(c.course_id);
}

const students = rawStudents.map(s => ({
  ...s,
  courses: coursesMap[s.id] || []
}));

const selectedSlotId = "Day-1-Morning";
const currentRoomId = "RM-A";

// Replicate studentRoomAssignment logic with getLayoutCapacity
const getLayoutCapacity = (rid: string) => {
  if (rid === "RM-A") return 60; // Custom capacity as seen in user's screenshot
  const r = rooms.find((rm) => rm.id === rid);
  return r?.capacity || 30;
};

const slotEntries = entries.filter((e) => e.timeslot_id === selectedSlotId);
const courseEntriesMap: Record<string, typeof slotEntries> = {};
slotEntries.forEach((e) => {
  if (!courseEntriesMap[e.course_id]) courseEntriesMap[e.course_id] = [];
  courseEntriesMap[e.course_id].push(e);
});

const studentRoomAssignment: Record<string, string> = {};

Object.keys(courseEntriesMap).forEach((cid) => {
  const courseEntries = courseEntriesMap[cid];
  const courseStudents: any[] = [];
  
  // Group by branch-section
  const secGroups: Record<string, any[]> = {};
  const rawStudentsFiltered = students.filter((s) => s.courses.some(c => c.trim().toUpperCase() === cid.trim().toUpperCase()));
  rawStudentsFiltered.forEach((s) => {
    const key = `${(s.branch || '').toUpperCase()}-${(s.section || '').toUpperCase()}`;
    if (!secGroups[key]) secGroups[key] = [];
    secGroups[key].push(s);
  });
  
  const sortedGroups: any[][] = [];
  Object.keys(secGroups).sort().forEach((key) => {
    const sorted = secGroups[key].sort((a, b) => a.id.localeCompare(b.id));
    sortedGroups.push(sorted);
  });

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

  const targetRoomIds: string[] = [];
  const remainingStudents = courseStudents.filter(s => !studentRoomAssignment[s.id]);
  const originalEntries = courseEntries.filter(e => !targetRoomIds.includes(e.room_id));

  if (originalEntries.length > 1) {
    // Keep user's priority order (RM-A, 1, RM-E, null)
    // Map entries to capacity
    const roomsWithCap = originalEntries.map((e) => {
      return {
        roomId: e.room_id,
        capacity: getLayoutCapacity(e.room_id),
      };
    });

    let assignedCount = 0;
    roomsWithCap.forEach((rObj, idx) => {
      let share = 0;
      if (idx === roomsWithCap.length - 1) {
        share = remainingStudents.length - assignedCount;
      } else {
        share = Math.min(rObj.capacity, remainingStudents.length - assignedCount);
      }
      const slice = remainingStudents.slice(assignedCount, assignedCount + share);
      slice.forEach((s) => {
        studentRoomAssignment[s.id] = rObj.roomId;
      });
      assignedCount += share;
    });
  }
});

const enrolledStudents = students.filter((s) => studentRoomAssignment[s.id] === currentRoomId);
console.log("Enrolled students count:", enrolledStudents.length);
console.log("Enrolled branches/sections:", enrolledStudents.reduce((acc, s) => {
  const key = `${s.branch}-${s.section}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {} as Record<string, number>));

// Run anti-cheat allocator
const totalStudentsInRoom = [...enrolledStudents];
const gridTotalSeats = 60;
const numCols = 6;
const numRows = 10;
const colHeights = Array(6).fill(10);
const maxRows = 10;
const fillDirection = "column-wise";

const defaultArr = Array(gridTotalSeats).fill(null);

const secGroupsSeating: Record<string, any[]> = {};
totalStudentsInRoom.forEach((s) => {
  const key = `1-${s.branch}-${s.section}`; // assuming year 1
  if (!secGroupsSeating[key]) secGroupsSeating[key] = [];
  secGroupsSeating[key].push(s);
});

Object.keys(secGroupsSeating).forEach((k) => {
  secGroupsSeating[k].sort((a, b) => a.id.localeCompare(b.id));
});

const uniqueKeys = Object.keys(secGroupsSeating).sort();
const majorKeys = uniqueKeys; // simplified
const interleavedKeys = uniqueKeys; // simplified

const scanOrder: { r: number; c: number }[] = [];
for (let c = 0; c < numCols; c++) {
  const height = colHeights[c] ?? numRows;
  for (let r = 0; r < height; r++) {
    scanOrder.push({ r, c });
  }
}

const colKeyMap: Record<number, string> = {};
for (let c = 0; c < numCols; c++) {
  colKeyMap[c] = interleavedKeys[c % interleavedKeys.length];
}

const getSeatIdx = (r: number, c: number) => {
  const activeSeatCoords: { r: number; c: number }[] = [];
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < colHeights[col]; row++) {
      activeSeatCoords.push({ r: row, c: col });
    }
  }
  return activeSeatCoords.findIndex((coord) => coord.r === r && coord.c === c);
};

for (const { r, c } of scanOrder) {
  const idx = getSeatIdx(r, c);
  if (idx === -1) continue;
  
  let targetKey = colKeyMap[c];
  if (targetKey && secGroupsSeating[targetKey] && secGroupsSeating[targetKey].length > 0) {
    defaultArr[idx] = secGroupsSeating[targetKey].shift().id;
  }
}

console.log("SEATED STUDENTS:");
for (let r = 0; r < numRows; r++) {
  let rowStr = "";
  for (let c = 0; c < numCols; c++) {
    const idx = getSeatIdx(r, c);
    rowStr += (defaultArr[idx] ? defaultArr[idx].substring(7) : "empty") + "\t";
  }
  console.log(rowStr);
}

db.close();
