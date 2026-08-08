import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Course, Room, Student, Invigilator, ScheduleEntry, AccommodationType } from '../src/types';

// Ensure database file is opened cleanly with a fallback to the system temporary directory if folder is read-only
const getDbPath = () => {
  const projectDbDir = typeof __dirname !== 'undefined'
    ? path.resolve(__dirname, '..', 'data')
    : (import.meta as any).dirname
      ? path.resolve((import.meta as any).dirname, '..', 'data')
      : path.resolve(process.cwd(), 'data');

  const projectDbPath = path.join(projectDbDir, 'exam_scheduler.db');

  try {
    // Try creating the project data directory if not exists
    if (!fs.existsSync(projectDbDir)) {
      fs.mkdirSync(projectDbDir, { recursive: true });
    }
    // Test if we can open/write to the database file in the project directory
    const testDb = new Database(projectDbPath);
    testDb.close();
    return projectDbPath;
  } catch (err: any) {
    console.warn(`[SQLite] Failed to write database in project folder: ${err.message}. Falling back to system temporary directory.`);
    
    // Fallback to system temp folder
    const tempDbDir = path.resolve(os.tmpdir(), 'exam_scheduler_data');
    if (!fs.existsSync(tempDbDir)) {
      fs.mkdirSync(tempDbDir, { recursive: true });
    }
    const tempDbPath = path.join(tempDbDir, 'exam_scheduler.db');

    // Copy seeded database from project directory to temp directory if temp file doesn't exist
    if (!fs.existsSync(tempDbPath) && fs.existsSync(projectDbPath)) {
      try {
        fs.copyFileSync(projectDbPath, tempDbPath);
        // Also copy wal/shm if they exist
        const projectWal = projectDbPath + '-wal';
        const tempWal = tempDbPath + '-wal';
        if (fs.existsSync(projectWal)) fs.copyFileSync(projectWal, tempWal);
        console.log(`[SQLite] Seeded database copied to: ${tempDbPath}`);
      } catch (copyErr: any) {
        console.error(`[SQLite] Failed to copy seeded database to temp path: ${copyErr.message}`);
      }
    }
    return tempDbPath;
  }
};

const dbPath = getDbPath();
export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrent read/write performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = DELETE');

export async function initDatabase(): Promise<void> {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      exam_start_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) NOT NULL,
      branch TEXT,
      year INTEGER CHECK(year BETWEEN 1 AND 4) DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      building TEXT NOT NULL,
      accessible INTEGER NOT NULL CHECK (accessible IN (0, 1)),
      block TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      year INTEGER CHECK(year BETWEEN 1 AND 4) DEFAULT 1,
      branch TEXT,
      section TEXT
    );

    CREATE TABLE IF NOT EXISTS student_courses (
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_accommodations (
      student_id TEXT NOT NULL,
      accommodation TEXT NOT NULL,
      PRIMARY KEY (student_id, accommodation),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invigilators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      department TEXT NOT NULL,
      max_workload INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invigilator_availability (
      invigilator_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      PRIMARY KEY (invigilator_id, slot_id),
      FOREIGN KEY (invigilator_id) REFERENCES invigilators(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      timeslot_id TEXT,
      room_id TEXT,
      invigilator_id TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    -- Performance indexes for frequent lookups and JOINs
    CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);
    CREATE INDEX IF NOT EXISTS idx_student_accoms_student ON student_accommodations(student_id);
    CREATE INDEX IF NOT EXISTS idx_invig_avail_invig ON invigilator_availability(invigilator_id);
    CREATE INDEX IF NOT EXISTS idx_invig_avail_slot ON invigilator_availability(slot_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_course ON schedule_entries(course_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_timeslot ON schedule_entries(timeslot_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_room ON schedule_entries(room_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_invig ON schedule_entries(invigilator_id);
  `);

  // Migrate schema to add email column if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(invigilators)").all() as any[];
    const hasEmail = tableInfo.some(col => col.name === 'email');
    if (!hasEmail) {
      db.prepare("ALTER TABLE invigilators ADD COLUMN email TEXT").run();
    }
  } catch (err) {
    console.error("Migration error for invigilators.email:", err);
  }

  // Migrate schema to add email column to students table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(students)").all() as any[];
    const hasEmail = tableInfo.some(col => col.name === 'email');
    if (!hasEmail) {
      db.prepare("ALTER TABLE students ADD COLUMN email TEXT").run();
    }
  } catch (err) {
    console.error("Migration error for students.email:", err);
  }

  // Migrate schema to add year column to courses table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(courses)").all() as any[];
    const hasYear = tableInfo.some(col => col.name === 'year');
    if (!hasYear) {
      db.prepare("ALTER TABLE courses ADD COLUMN year INTEGER DEFAULT 1").run();
    }
  } catch (err) {
    console.error("Migration error for courses.year:", err);
  }

  // Migrate schema to add year column to students table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(students)").all() as any[];
    const hasYear = tableInfo.some(col => col.name === 'year');
    if (!hasYear) {
      db.prepare("ALTER TABLE students ADD COLUMN year INTEGER DEFAULT 1").run();
    }
  } catch (err) {
    console.error("Migration error for students.year:", err);
  }

  // Migrate schema to add branch column to students table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(students)").all() as any[];
    const hasBranch = tableInfo.some(col => col.name === 'branch');
    if (!hasBranch) {
      db.prepare("ALTER TABLE students ADD COLUMN branch TEXT").run();
    }
  } catch (err) {
    console.error("Migration error for students.branch:", err);
  }

  // Migrate schema to add section column to students table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(students)").all() as any[];
    const hasSection = tableInfo.some(col => col.name === 'section');
    if (!hasSection) {
      db.prepare("ALTER TABLE students ADD COLUMN section TEXT").run();
    }
  } catch (err) {
    console.error("Migration error for students.section:", err);
  }

  // Migrate schema to add block column to rooms table if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(rooms)").all() as any[];
    const hasBlock = tableInfo.some(col => col.name === 'block');
    if (!hasBlock) {
      db.prepare("ALTER TABLE rooms ADD COLUMN block TEXT").run();
    }
  } catch (err) {
    console.error("Migration error for rooms.block:", err);
  }

  // Migrate schedule_entries to allow null/empty
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_entries_new (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          timeslot_id TEXT,
          room_id TEXT,
          invigilator_id TEXT,
          FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
      `);
      db.exec(`INSERT OR IGNORE INTO schedule_entries_new SELECT * FROM schedule_entries`);
      db.exec(`DROP TABLE schedule_entries`);
      db.exec(`ALTER TABLE schedule_entries_new RENAME TO schedule_entries`);
    })();
  } catch (err) {
    console.error("Migration error for schedule_entries:", err);
  }

  // Seed default college if empty
  const collegeCount = db.prepare('SELECT COUNT(*) as count FROM colleges').get() as { count: number };
  if (collegeCount.count === 0) {
    db.prepare('INSERT INTO colleges (id, name, exam_start_date) VALUES (1, ?, ?)')
      .run('State Institute of Technology', '2026-06-15');
  }

  // Seed default branches if empty
  const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  if (branchCount.count === 0) {
    const defaultBranches = [
      'Computer Science',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Information Technology',
      'Civil Engineering'
    ];
    const insertBranch = db.prepare('INSERT INTO branches (name) VALUES (?)');
    db.transaction(() => {
      for (const b of defaultBranches) {
        insertBranch.run(b);
      }
    })();
  }
}

// ==========================================
// COURSE CRUD
// ==========================================

export async function getAllCourses(): Promise<Course[]> {
  const rows = db.prepare('SELECT * FROM courses').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    duration: r.duration,
    priority: r.priority,
    branch: r.branch || undefined,
    year: r.year || 1
  }));
}

export async function getCourse(id: string): Promise<Course | undefined> {
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    duration: row.duration,
    priority: row.priority,
    branch: row.branch || undefined,
    year: row.year || 1
  };
}

export async function createCourse(course: Course): Promise<Course> {
  db.prepare('INSERT INTO courses (id, name, duration, priority, branch, year) VALUES (?, ?, ?, ?, ?, ?)')
    .run(course.id, course.name, course.duration, course.priority, course.branch || null, course.year || 1);
  return course;
}

export async function updateCourse(id: string, course: Partial<Course>): Promise<Course> {
  const current = await getCourse(id);
  if (!current) throw new Error(`Course with ID ${id} not found`);
  const updated = { ...current, ...course };
  db.prepare('UPDATE courses SET name = ?, duration = ?, priority = ?, branch = ?, year = ? WHERE id = ?')
    .run(updated.name, updated.duration, updated.priority, updated.branch || null, updated.year || 1, id);
  return updated;
}

export async function deleteCourse(id: string): Promise<void> {
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
}

// ==========================================
// ROOM CRUD
// ==========================================

export async function getAllRooms(): Promise<Room[]> {
  const rows = db.prepare('SELECT * FROM rooms').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    building: r.building,
    accessible: r.accessible === 1,
    block: r.block || undefined
  }));
}

export async function getRoom(id: string): Promise<Room | undefined> {
  const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    building: row.building,
    accessible: row.accessible === 1,
    block: row.block || undefined
  };
}

export async function createRoom(room: Room): Promise<Room> {
  db.prepare('INSERT INTO rooms (id, name, capacity, building, accessible, block) VALUES (?, ?, ?, ?, ?, ?)')
    .run(room.id, room.name, room.capacity, room.building, room.accessible ? 1 : 0, room.block || null);
  return room;
}

export async function updateRoom(id: string, room: Partial<Room>): Promise<Room> {
  const current = await getRoom(id);
  if (!current) throw new Error(`Room with ID ${id} not found`);
  const updated = { ...current, ...room };
  db.prepare('UPDATE rooms SET name = ?, capacity = ?, building = ?, accessible = ?, block = ? WHERE id = ?')
    .run(updated.name, updated.capacity, updated.building, updated.accessible ? 1 : 0, updated.block || null, id);
  return updated;
}

export async function deleteRoom(id: string): Promise<void> {
  db.transaction(() => {
    db.prepare('UPDATE schedule_entries SET room_id = NULL WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  })();
}

// ==========================================
// STUDENT CRUD
// ==========================================

export async function getAllStudents(): Promise<Student[]> {
  const students = db.prepare('SELECT * FROM students').all() as any[];
  const allCourses = db.prepare('SELECT * FROM student_courses').all() as any[];
  const allAccommodations = db.prepare('SELECT * FROM student_accommodations').all() as any[];

  // Group by student_id
  const coursesMap: Record<string, string[]> = {};
  for (const c of allCourses) {
    if (!coursesMap[c.student_id]) coursesMap[c.student_id] = [];
    coursesMap[c.student_id].push(c.course_id);
  }

  const accomsMap: Record<string, AccommodationType[]> = {};
  for (const a of allAccommodations) {
    if (!accomsMap[a.student_id]) accomsMap[a.student_id] = [];
    accomsMap[a.student_id].push(a.accommodation as AccommodationType);
  }

  return students.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email || undefined,
    courses: coursesMap[s.id] || [],
    accommodations: accomsMap[s.id] || [],
    year: s.year || 1,
    branch: s.branch || undefined,
    section: s.section || undefined
  }));
}

export async function getStudent(id: string): Promise<Student | undefined> {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any;
  if (!student) return undefined;

  const courses = (db.prepare('SELECT course_id FROM student_courses WHERE student_id = ?').all(id) as any[])
    .map(c => c.course_id);

  const accommodations = (db.prepare('SELECT accommodation FROM student_accommodations WHERE student_id = ?').all(id) as any[])
    .map(a => a.accommodation as AccommodationType);

  return {
    id: student.id,
    name: student.name,
    email: student.email || undefined,
    courses,
    accommodations,
    year: student.year || 1,
    branch: student.branch || undefined,
    section: student.section || undefined
  };
}

export async function createStudent(student: Student): Promise<Student> {
  const insertStudent = db.prepare('INSERT INTO students (id, name, email, year, branch, section) VALUES (?, ?, ?, ?, ?, ?)');
  const insertCourse = db.prepare('INSERT INTO student_courses (student_id, course_id) VALUES (?, ?)');
  const insertAccom = db.prepare('INSERT INTO student_accommodations (student_id, accommodation) VALUES (?, ?)');

  // Filter course IDs to only those that exist in the courses table to avoid FK violations
  const existingCourseIds = new Set(
    (db.prepare('SELECT id FROM courses').all() as any[]).map(r => r.id)
  );
  const validCourses = student.courses.filter(cId => existingCourseIds.has(cId));

  db.transaction(() => {
    insertStudent.run(student.id, student.name, student.email || null, student.year || 1, student.branch || null, student.section || null);
    for (const cId of validCourses) {
      insertCourse.run(student.id, cId);
    }
    for (const accom of student.accommodations) {
      insertAccom.run(student.id, accom);
    }
  })();

  return { ...student, courses: validCourses };
}

export async function updateStudent(id: string, student: Partial<Student>): Promise<Student> {
  const current = await getStudent(id);
  if (!current) throw new Error(`Student with ID ${id} not found`);
  const updated = { ...current, ...student };

  const updateFields = db.prepare('UPDATE students SET name = ?, email = ?, year = ?, branch = ?, section = ? WHERE id = ?');
  const deleteCourses = db.prepare('DELETE FROM student_courses WHERE student_id = ?');
  const insertCourse = db.prepare('INSERT INTO student_courses (student_id, course_id) VALUES (?, ?)');
  const deleteAccoms = db.prepare('DELETE FROM student_accommodations WHERE student_id = ?');
  const insertAccom = db.prepare('INSERT INTO student_accommodations (student_id, accommodation) VALUES (?, ?)');

  // Filter course IDs to only those that exist in the courses table to avoid FK violations
  const existingCourseIds = new Set(
    (db.prepare('SELECT id FROM courses').all() as any[]).map(r => r.id)
  );
  const validCourses = updated.courses.filter(cId => existingCourseIds.has(cId));

  db.transaction(() => {
    updateFields.run(updated.name, updated.email || null, updated.year || 1, updated.branch || null, updated.section || null, id);
    
    // Replace courses
    deleteCourses.run(id);
    for (const cId of validCourses) {
      insertCourse.run(id, cId);
    }

    // Replace accommodations
    deleteAccoms.run(id);
    for (const accom of updated.accommodations) {
      insertAccom.run(id, accom);
    }
  })();

  return updated;
}

export async function deleteStudent(id: string): Promise<void> {
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
}

// Helper query for sending notification emails
export async function getStudentsByCourse(courseId: string): Promise<{ id: string; name: string; email: string }[]> {
  const snapshot = db.prepare(`
    SELECT s.id, s.name, s.email 
    FROM students s
    JOIN student_courses sc ON s.id = sc.student_id
    WHERE sc.course_id = ? AND s.email IS NOT NULL AND s.email != ''
  `).all(courseId) as any[];

  return snapshot.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email
  }));
}

// ==========================================
// INVIGILATOR CRUD
// ==========================================

export async function getAllInvigilators(): Promise<Invigilator[]> {
  const invigilators = db.prepare('SELECT * FROM invigilators').all() as any[];
  const allAvailability = db.prepare('SELECT * FROM invigilator_availability').all() as any[];

  // Group by invigilator_id
  const availMap: Record<string, string[]> = {};
  for (const a of allAvailability) {
    if (!availMap[a.invigilator_id]) availMap[a.invigilator_id] = [];
    availMap[a.invigilator_id].push(a.slot_id);
  }

  return invigilators.map(i => ({
    id: i.id,
    name: i.name,
    email: i.email || undefined,
    department: i.department,
    availability: availMap[i.id] || [],
    maxWorkload: i.max_workload
  }));
}

export async function getInvigilator(id: string): Promise<Invigilator | undefined> {
  const inv = db.prepare('SELECT * FROM invigilators WHERE id = ?').get(id) as any;
  if (!inv) return undefined;

  const availability = (db.prepare('SELECT slot_id FROM invigilator_availability WHERE invigilator_id = ?').all(id) as any[])
    .map(a => a.slot_id);

  return {
    id: inv.id,
    name: inv.name,
    email: inv.email || undefined,
    department: inv.department,
    availability,
    maxWorkload: inv.max_workload
  };
}

export async function createInvigilator(inv: Invigilator): Promise<Invigilator> {
  const insertInv = db.prepare('INSERT INTO invigilators (id, name, email, department, max_workload) VALUES (?, ?, ?, ?, ?)');
  const insertAvail = db.prepare('INSERT INTO invigilator_availability (invigilator_id, slot_id) VALUES (?, ?)');

  db.transaction(() => {
    insertInv.run(inv.id, inv.name, inv.email || null, inv.department, inv.maxWorkload);
    for (const slotId of inv.availability) {
      insertAvail.run(inv.id, slotId);
    }
  })();

  return inv;
}

export async function updateInvigilator(id: string, inv: Partial<Invigilator>): Promise<Invigilator> {
  const current = await getInvigilator(id);
  if (!current) throw new Error(`Invigilator with ID ${id} not found`);
  const updated = { ...current, ...inv };

  const updateFields = db.prepare('UPDATE invigilators SET name = ?, email = ?, department = ?, max_workload = ? WHERE id = ?');
  const deleteAvail = db.prepare('DELETE FROM invigilator_availability WHERE invigilator_id = ?');
  const insertAvail = db.prepare('INSERT INTO invigilator_availability (invigilator_id, slot_id) VALUES (?, ?)');

  db.transaction(() => {
    updateFields.run(updated.name, updated.email || null, updated.department, updated.maxWorkload, id);
    
    // Replace availability
    deleteAvail.run(id);
    for (const slotId of updated.availability) {
      insertAvail.run(id, slotId);
    }
  })();

  return updated;
}

export async function deleteInvigilator(id: string): Promise<void> {
  db.transaction(() => {
    db.prepare('UPDATE schedule_entries SET invigilator_id = NULL WHERE invigilator_id = ?').run(id);
    db.prepare('DELETE FROM invigilators WHERE id = ?').run(id);
  })();
}

// ==========================================
// SCHEDULE ENTRIES CRUD
// ==========================================

export async function getAllScheduleEntries(): Promise<ScheduleEntry[]> {
  const rows = db.prepare('SELECT * FROM schedule_entries').all() as any[];
  return rows.map(r => ({
    id: r.id,
    courseId: r.course_id,
    timeslotId: r.timeslot_id,
    roomId: r.room_id,
    invigilatorId: r.invigilator_id
  }));
}

export async function createScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry> {
  db.prepare('INSERT INTO schedule_entries (id, course_id, timeslot_id, room_id, invigilator_id) VALUES (?, ?, ?, ?, ?)')
    .run(entry.id, entry.courseId, entry.timeslotId, entry.roomId, entry.invigilatorId);
  return entry;
}

export async function updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry> {
  const currentRows = db.prepare('SELECT * FROM schedule_entries WHERE id = ?').get(id) as any;
  if (!currentRows) throw new Error(`Schedule entry with ID ${id} not found`);

  const current: ScheduleEntry = {
    id: currentRows.id,
    courseId: currentRows.course_id,
    timeslotId: currentRows.timeslot_id,
    roomId: currentRows.room_id,
    invigilatorId: currentRows.invigilator_id
  };
  const updated = { ...current, ...entry };

  db.prepare('UPDATE schedule_entries SET course_id = ?, timeslot_id = ?, room_id = ?, invigilator_id = ? WHERE id = ?')
    .run(updated.courseId, updated.timeslotId, updated.roomId, updated.invigilatorId, id);
  return updated;
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  db.prepare('DELETE FROM schedule_entries WHERE id = ?').run(id);
}

export async function clearScheduleEntries(): Promise<void> {
  db.prepare('DELETE FROM schedule_entries').run();
}

export async function bulkReplaceScheduleEntries(entries: ScheduleEntry[]): Promise<ScheduleEntry[]> {
  const insertEntry = db.prepare('INSERT INTO schedule_entries (id, course_id, timeslot_id, room_id, invigilator_id) VALUES (?, ?, ?, ?, ?)');
  
  // Filter to only entries whose courseId exists in the courses table to avoid FK violations
  const existingCourseIds = new Set(
    (db.prepare('SELECT id FROM courses').all() as any[]).map(r => r.id)
  );

  db.transaction(() => {
    db.prepare('DELETE FROM schedule_entries').run();
    for (const entry of entries) {
      if (!existingCourseIds.has(entry.courseId)) continue; // Skip orphaned entries
      // Coerce empty strings to NULL so FK constraints don't fail on placeholder values
      const roomId = entry.roomId || null;
      const invigilatorId = entry.invigilatorId || null;
      const timeslotId = entry.timeslotId || null;
      insertEntry.run(entry.id, entry.courseId, timeslotId, roomId, invigilatorId);
    }
  })();

  return entries;
}

// ==========================================
// BRANCHES CRUD
// ==========================================

export async function getAllBranches(): Promise<string[]> {
  const rows = db.prepare('SELECT name FROM branches ORDER BY name ASC').all() as { name: string }[];
  return rows.map(r => r.name);
}

export async function addBranch(name: string): Promise<void> {
  db.prepare('INSERT OR IGNORE INTO branches (name) VALUES (?)').run(name);
}

export async function deleteBranch(name: string): Promise<void> {
  db.prepare('DELETE FROM branches WHERE name = ?').run(name);
}

// ==========================================
// COLLEGE INFO
// ==========================================

export async function getCollege(): Promise<{ name: string; examStartDate: string }> {
  const row = db.prepare('SELECT name, exam_start_date FROM colleges WHERE id = 1').get() as any;
  return {
    name: row.name,
    examStartDate: row.exam_start_date
  };
}

export async function updateCollege(name: string, examStartDate: string): Promise<void> {
  db.prepare('UPDATE colleges SET name = ?, exam_start_date = ? WHERE id = 1')
    .run(name, examStartDate);
}
