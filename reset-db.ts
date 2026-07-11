import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const getDbDir = () => {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(__dirname, 'data');
  }
  const meta = import.meta as any;
  if (meta && meta.dirname) {
    return path.resolve(meta.dirname, 'data');
  }
  return path.resolve(process.cwd(), 'data');
};
const dbDir = getDbDir();
const dbPath = path.join(dbDir, 'exam_scheduler.db');
const walPath = path.join(dbDir, 'exam_scheduler.db-wal');
const shmPath = path.join(dbDir, 'exam_scheduler.db-shm');
const backupPath = path.join(dbDir, 'exam_scheduler_backup.db');

console.log('Resetting SQLite database...');

// 1. Delete existing database files to start completely fresh
const filesToDelete = [dbPath, walPath, shmPath, backupPath];
for (const file of filesToDelete) {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`Deleted existing file: ${file}`);
    } catch (err: any) {
      console.error(`Warning: Could not delete ${file}. It might be locked. Error: ${err.message}`);
    }
  }
}

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

try {
  // 2. Initialize fresh SQLite database
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  console.log('Creating database tables...');
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
      accessible INTEGER NOT NULL CHECK (accessible IN (0, 1))
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

  console.log('Cleaning up existing database tables...');
  db.exec(`
    DELETE FROM schedule_entries;
    DELETE FROM student_accommodations;
    DELETE FROM student_courses;
    DELETE FROM students;
    DELETE FROM invigilator_availability;
    DELETE FROM invigilators;
    DELETE FROM rooms;
    DELETE FROM courses;
    DELETE FROM branches;
    DELETE FROM colleges;
  `);

  console.log('Seeding default college & branches...');
  db.prepare('INSERT INTO colleges (id, name, exam_start_date) VALUES (1, ?, ?)')
    .run('State Institute of Technology', '2026-06-15');

  const defaultBranches = [
    'Computer Science & Eng',
    'Electrical & Electronics',
    'Mechanical Engineering',
    'Civil Engineering',
    'Business & Humanities'
  ];
  for (const name of defaultBranches) {
    db.prepare('INSERT OR IGNORE INTO branches (name) VALUES (?)').run(name);
  }

  // 3. Define Seed Data
  const courses = [
    { id: "CS-101", name: "Introduction to Computer Science", duration: 120, priority: "High", branch: "Computer Science & Eng", year: 1 },
    { id: "MATH-201", name: "Differential Calculus", duration: 180, priority: "High", branch: "Computer Science & Eng", year: 2 },
    { id: "PHY-110", name: "Physics: Optics & Electromagnetism", duration: 120, priority: "Medium", branch: "Electrical & Electronics", year: 1 },
    { id: "CHEM-120", name: "Analytical Organic Chemistry", duration: 150, priority: "Medium", branch: "Business & Humanities", year: 3 },
    { id: "BIO-101", name: "Cellular & Molecular Biology", duration: 120, priority: "Low", branch: "Business & Humanities", year: 2 },
    { id: "LIT-305", name: "Contemporary Literature Studies", duration: 90, priority: "Low", branch: "Business & Humanities", year: 4 },
    { id: "23IT301", name: "Information Technology", duration: 120, priority: "High", branch: "Computer Science & Eng", year: 3 },
    { id: "ENG-220", name: "Advanced Engineering Design", duration: 180, priority: "High", branch: "Mechanical Engineering", year: 4 },
  ];

  const rooms = [
    { id: "RM-101", name: "Grand Exhibition Hall", capacity: 50, building: "Science Block A", block: "Block 1", accessible: 1 },
    { id: "RM-204", name: "Advanced Computing Lab", capacity: 25, building: "Turing Plaza", block: "Block 2", accessible: 1 },
    { id: "RM-305", name: "General Lecture Room", capacity: 30, building: "Liberal Arts Wing", block: "Block 3", accessible: 0 },
    { id: "RM-12", name: "Scribe Annex Room 3", capacity: 10, building: "Administration Ground", block: "Block 4", accessible: 1 },
  ];

  const invigilators = [
    { id: "INV-101", name: "Dr. Elizabeth Vance", email: "elizabeth.vance@state.edu", department: "Science", maxWorkload: 3, availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning"] },
    { id: "INV-102", name: "Prof. Marcus Brody", email: "marcus.brody@state.edu", department: "Linguistics", maxWorkload: 2, availability: ["Day-1-Morning", "Day-1-Evening", "Day-2-Afternoon", "Day-3-Afternoon"] },
    { id: "INV-103", name: "Dr. Sarah Connor", email: "sarah.connor@state.edu", department: "Mathematics", maxWorkload: 4, availability: ["Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning", "Day-3-Afternoon", "Day-3-Evening"] },
    { id: "INV-104", name: "Dr. Henry Jones", email: "henry.jones@state.edu", department: "History", maxWorkload: 3, availability: ["Day-1-Evening", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning", "Day-3-Evening"] },
    { id: "INV-105", name: "Prof. Rupert Giles", email: "rupert.giles@state.edu", department: "Humanities", maxWorkload: 3, availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-3-Afternoon", "Day-3-Evening"] },
  ];

  const generateStudents = () => {
    const firstNames = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"];
    const studentsList: any[] = [];
    const accommodationsList = ["extra_time", "separate_room", "accessible", "scribe"];

    for (let i = 1; i <= 100; i++) {
      const fn = firstNames[(i * 3 + 7) % firstNames.length];
      const ln = lastNames[(i * 7 + 11) % lastNames.length];
      const name = `${fn} ${ln}`;
      const id = `STU-${i.toString().padStart(3, '0')}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@college.edu`;
      
      const year = ((i - 1) % 4) + 1; // Distribute 1, 2, 3, 4 evenly

      const yearCourses: Record<number, string[]> = {
        1: ["CS-101", "PHY-110"],
        2: ["MATH-201", "BIO-101"],
        3: ["CHEM-120", "23IT301"],
        4: ["LIT-305", "ENG-220"]
      };

      const studentCourses = [...yearCourses[year]];
      if (i % 3 === 0) {
        studentCourses.push("LIT-305");
      }

      const accommodations: string[] = [];
      if (i % 7 === 0) {
        accommodations.push(accommodationsList[i % accommodationsList.length]);
      }

      const branchOptions = ["CSE", "ECE", "EEE"];
      const sectionOptions = ["A", "B", "C", "D"];
      const branch = branchOptions[i % branchOptions.length];
      const section = sectionOptions[i % sectionOptions.length];

      studentsList.push({
        id,
        name,
        email,
        courses: Array.from(new Set(studentCourses)),
        accommodations,
        year,
        branch,
        section
      });
    }
    return studentsList;
  };

  const students = generateStudents();

  console.log('Seeding courses...');
  const insertCourse = db.prepare('INSERT INTO courses (id, name, duration, priority, branch, year) VALUES (?, ?, ?, ?, ?, ?)');
  for (const c of courses) {
    insertCourse.run(c.id, c.name, c.duration, c.priority, c.branch, c.year);
  }

  console.log('Seeding rooms...');
  const insertRoom = db.prepare('INSERT INTO rooms (id, name, capacity, building, accessible, block) VALUES (?, ?, ?, ?, ?, ?)');
  for (const r of rooms) {
    insertRoom.run(r.id, r.name, r.capacity, r.building, r.accessible, r.block);
  }

  console.log('Seeding invigilators...');
  const insertInvig = db.prepare('INSERT INTO invigilators (id, name, email, department, max_workload) VALUES (?, ?, ?, ?, ?)');
  const insertAvail = db.prepare('INSERT INTO invigilator_availability (invigilator_id, slot_id) VALUES (?, ?)');
  for (const iv of invigilators) {
    insertInvig.run(iv.id, iv.name, iv.email, iv.department, iv.maxWorkload);
    for (const slot of iv.availability) {
      insertAvail.run(iv.id, slot);
    }
  }

  console.log('Seeding students...');
  const insertStudent = db.prepare('INSERT INTO students (id, name, email, year, branch, section) VALUES (?, ?, ?, ?, ?, ?)');
  const insertStudentCourse = db.prepare('INSERT INTO student_courses (student_id, course_id) VALUES (?, ?)');
  const insertStudentAccom = db.prepare('INSERT INTO student_accommodations (student_id, accommodation) VALUES (?, ?)');
  for (const s of students) {
    insertStudent.run(s.id, s.name, s.email || null, s.year, s.branch || null, s.section || null);
    for (const cId of s.courses) {
      insertStudentCourse.run(s.id, cId);
    }
    for (const accom of s.accommodations) {
      insertStudentAccom.run(s.id, accom);
    }
  }

  console.log('Seeding schedule drafts...');
  const insertEntry = db.prepare('INSERT INTO schedule_entries (id, course_id, timeslot_id, room_id, invigilator_id) VALUES (?, ?, ?, ?, ?)');
  // Draft assignments greedily across slots and rooms
  const timeslots = ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning"];
  courses.forEach((crs, index) => {
    const slotId = timeslots[index % timeslots.length];
    const roomId = rooms[index % rooms.length].id;
    const invigId = invigilators[index % invigilators.length].id;
    insertEntry.run(`ent_${crs.id}`, crs.id, slotId, roomId, invigId);
  });

  console.log('\nAll tables populated successfully with fresh mock data!');
  
  // Close cleanly so it checkpoints WAL log data
  db.close();
  console.log('Database connection closed cleanly.');
  process.exit(0);
} catch (err: any) {
  console.error('Error during database seed:', err.message);
  process.exit(1);
}
