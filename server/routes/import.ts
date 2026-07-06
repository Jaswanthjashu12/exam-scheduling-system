import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  createStudent, createCourse, createRoom, createInvigilator,
  getAllStudents, getAllCourses, getAllRooms, getAllInvigilators,
  deleteStudent, deleteCourse, deleteRoom, deleteInvigilator
} from '../db';
import { Student, Course, Room, Invigilator, AccommodationType } from '../../src/types';

const router = Router();

// Configure multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/csv',
    ];
    // Also accept by extension
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (allowed.includes(file.mimetype) || ['xlsx', 'xls', 'csv'].includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
    }
  }
});

// Helper: read workbook from buffer
function parseExcelBuffer(buffer: Buffer, filename: string): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error('Excel file has no sheets');
  const sheet = workbook.Sheets[firstSheet];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return jsonData;
}

// Helper: normalize column header names (lowercase, trim, remove spaces/underscores)
function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim().replace(/[\s_-]+/g, '');
}

// Helper: find a value from a row using possible column name aliases
function findValue(row: any, aliases: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = normalizeHeader(key);
    if (aliases.includes(norm)) {
      return String(row[key]).trim();
    }
  }
  return '';
}

function findNumericValue(row: any, aliases: string[], defaultVal: number): number {
  const val = findValue(row, aliases);
  const n = Number(val);
  return isNaN(n) || val === '' ? defaultVal : n;
}

function findBoolValue(row: any, aliases: string[], defaultVal: boolean): boolean {
  const val = findValue(row, aliases).toLowerCase();
  if (val === '' || val === undefined) return defaultVal;
  return ['true', 'yes', '1', 'y', 'accessible', '✓', '✔'].includes(val);
}

// ==========================================
// POST /api/import/students
// ==========================================
router.post('/students', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mode = (req.body?.mode || 'append') as 'append' | 'replace';
    const rows = parseExcelBuffer(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows' });
    }

    // If replace mode, delete all existing students first
    if (mode === 'replace') {
      const existing = getAllStudents();
      for (const s of existing) {
        deleteStudent(s.id);
      }
    }

    const validAccommodations: AccommodationType[] = ['extra_time', 'separate_room', 'accessible', 'scribe'];
    const imported: Student[] = [];
    const errors: string[] = [];
    const existingIds = new Set(mode === 'append' ? getAllStudents().map(s => s.id) : []);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row + 0-index

      const id = findValue(row, ['id', 'studentid', 'rollno', 'rollnumber', 'enrollmentno', 'enrollment', 'regno', 'registrationno']);
      const name = findValue(row, ['name', 'fullname', 'studentname', 'firstname']);
      const email = findValue(row, ['email', 'emailid', 'emailaddress', 'mail']);
      const coursesRaw = findValue(row, ['courses', 'enrolledcourses', 'subjects', 'coursecodes', 'courseids', 'examcourses']);
      const accsRaw = findValue(row, ['accommodations', 'specialaccommodations', 'accommodation', 'specialneeds', 'needs', 'disability']);

      if (!id) { errors.push(`Row ${rowNum}: Missing student ID`); continue; }
      if (!name) { errors.push(`Row ${rowNum}: Missing student name`); continue; }
      if (existingIds.has(id)) { errors.push(`Row ${rowNum}: Duplicate ID '${id}' — skipped`); continue; }

      // Parse courses: comma-separated or semicolon-separated
      const courses = coursesRaw
        ? coursesRaw.split(/[,;|]+/).map(c => c.trim().toUpperCase()).filter(Boolean)
        : [];

      // Parse accommodations
      const accommodations: AccommodationType[] = accsRaw
        ? accsRaw.split(/[,;|]+/)
          .map(a => a.trim().toLowerCase().replace(/\s+/g, '_'))
          .filter(a => validAccommodations.includes(a as AccommodationType)) as AccommodationType[]
        : [];

      const student: Student = { id: id.toUpperCase(), name, email: email || undefined, courses, accommodations };

      try {
        createStudent(student);
        imported.push(student);
        existingIds.add(id);
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to create student'}`);
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      imported: imported.length,
      errors,
      data: imported
    });
  } catch (err: any) {
    if (err.message?.includes('Only .xlsx')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// POST /api/import/invigilators
// ==========================================
router.post('/invigilators', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mode = (req.body?.mode || 'append') as 'append' | 'replace';
    const rows = parseExcelBuffer(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows' });
    }

    if (mode === 'replace') {
      const existing = getAllInvigilators();
      for (const inv of existing) {
        deleteInvigilator(inv.id);
      }
    }

    const imported: Invigilator[] = [];
    const errors: string[] = [];
    const existingIds = new Set(mode === 'append' ? getAllInvigilators().map(i => i.id) : []);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const id = findValue(row, ['id', 'invigilatorid', 'proctorid', 'staffid', 'empid', 'employeeid']);
      const name = findValue(row, ['name', 'fullname', 'invigilatorname', 'proctorname', 'staffname']);
      const email = findValue(row, ['email', 'emailid', 'emailaddress', 'mail']);
      const department = findValue(row, ['department', 'dept', 'branch', 'division', 'section']) || 'General';
      const maxWorkload = findNumericValue(row, ['maxworkload', 'workload', 'maxduties', 'maxassignments', 'dutylimit'], 3);
      const availRaw = findValue(row, ['availability', 'availableslots', 'slots', 'availabledays', 'schedule']);

      if (!id) { errors.push(`Row ${rowNum}: Missing invigilator ID`); continue; }
      if (!name) { errors.push(`Row ${rowNum}: Missing invigilator name`); continue; }
      if (existingIds.has(id)) { errors.push(`Row ${rowNum}: Duplicate ID '${id}' — skipped`); continue; }

      // Parse availability: comma-separated slot IDs
      const availability = availRaw
        ? availRaw.split(/[,;|]+/).map(s => s.trim()).filter(Boolean)
        : ['Day-1-Morning', 'Day-1-Afternoon', 'Day-2-Morning', 'Day-2-Afternoon'];

      const invig: Invigilator = {
        id: id.toUpperCase(),
        name,
        email: email || undefined,
        department,
        availability,
        maxWorkload
      };

      try {
        createInvigilator(invig);
        imported.push(invig);
        existingIds.add(id);
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to create invigilator'}`);
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      imported: imported.length,
      errors,
      data: imported
    });
  } catch (err: any) {
    if (err.message?.includes('Only .xlsx')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// POST /api/import/courses
// ==========================================
router.post('/courses', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mode = (req.body?.mode || 'append') as 'append' | 'replace';
    const rows = parseExcelBuffer(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows' });
    }

    if (mode === 'replace') {
      const existing = getAllCourses();
      for (const c of existing) {
        deleteCourse(c.id);
      }
    }

    const imported: Course[] = [];
    const errors: string[] = [];
    const existingIds = new Set(mode === 'append' ? getAllCourses().map(c => c.id) : []);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const id = findValue(row, ['id', 'courseid', 'coursecode', 'code', 'subjectcode', 'subjectid']);
      const name = findValue(row, ['name', 'coursename', 'subjectname', 'title', 'subject']);
      const duration = findNumericValue(row, ['duration', 'durationminutes', 'durationmins', 'examduration', 'minutes', 'time'], 120);
      const priorityRaw = findValue(row, ['priority', 'importancelevel', 'importance', 'level']).toLowerCase();
      const branch = findValue(row, ['branch', 'department', 'dept', 'major', 'faculty', 'academicbranch']);

      if (!id) { errors.push(`Row ${rowNum}: Missing course ID`); continue; }
      if (!name) { errors.push(`Row ${rowNum}: Missing course name`); continue; }
      if (existingIds.has(id.toUpperCase())) { errors.push(`Row ${rowNum}: Duplicate ID '${id}' — skipped`); continue; }

      let priority: 'High' | 'Medium' | 'Low' = 'Medium';
      if (['high', 'h', '3', 'critical'].includes(priorityRaw)) priority = 'High';
      else if (['low', 'l', '1', 'minor'].includes(priorityRaw)) priority = 'Low';

      const course: Course = {
        id: id.toUpperCase(),
        name,
        duration,
        priority,
        branch: branch || undefined
      };

      try {
        createCourse(course);
        imported.push(course);
        existingIds.add(id.toUpperCase());
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to create course'}`);
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      imported: imported.length,
      errors,
      data: imported
    });
  } catch (err: any) {
    if (err.message?.includes('Only .xlsx')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// POST /api/import/rooms
// ==========================================
router.post('/rooms', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mode = (req.body?.mode || 'append') as 'append' | 'replace';
    const rows = parseExcelBuffer(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File contains no data rows' });
    }

    if (mode === 'replace') {
      const existing = getAllRooms();
      for (const r of existing) {
        deleteRoom(r.id);
      }
    }

    const imported: Room[] = [];
    const errors: string[] = [];
    const existingIds = new Set(mode === 'append' ? getAllRooms().map(r => r.id) : []);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const id = findValue(row, ['id', 'roomid', 'roomcode', 'roomno', 'hallid', 'code']);
      const name = findValue(row, ['name', 'roomname', 'hallname', 'venuename', 'venue']);
      const capacity = findNumericValue(row, ['capacity', 'seats', 'maxcapacity', 'seatcount', 'totalseats'], 30);
      const building = findValue(row, ['building', 'block', 'buildingname', 'wing', 'location']) || 'Main Building';
      const accessible = findBoolValue(row, ['accessible', 'wheelchair', 'handicapaccessible', 'accessibility', 'wheelchairaccessible'], false);

      if (!id) { errors.push(`Row ${rowNum}: Missing room ID`); continue; }
      if (!name) { errors.push(`Row ${rowNum}: Missing room name`); continue; }
      if (existingIds.has(id.toUpperCase())) { errors.push(`Row ${rowNum}: Duplicate ID '${id}' — skipped`); continue; }

      const room: Room = {
        id: id.toUpperCase(),
        name,
        capacity,
        building,
        accessible
      };

      try {
        createRoom(room);
        imported.push(room);
        existingIds.add(id.toUpperCase());
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to create room'}`);
      }
    }

    res.json({
      success: true,
      totalRows: rows.length,
      imported: imported.length,
      errors,
      data: imported
    });
  } catch (err: any) {
    if (err.message?.includes('Only .xlsx')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// GET /api/import/template/:type — Download Excel template
// ==========================================
router.get('/template/:type', (req, res) => {
  const { type } = req.params;
  const wb = XLSX.utils.book_new();
  let sheetData: any[] = [];

  switch (type) {
    case 'students':
      sheetData = [
        { 'Student ID': 'STU-001', 'Name': 'John Doe', 'Courses': 'CS-101, MATH-201', 'Accommodations': 'extra_time' },
        { 'Student ID': 'STU-002', 'Name': 'Jane Smith', 'Courses': 'PHY-302, BIO-105', 'Accommodations': '' },
        { 'Student ID': 'STU-003', 'Name': 'Alex Kumar', 'Courses': 'CS-101, PHY-302', 'Accommodations': 'separate_room, accessible' },
      ];
      break;
    case 'invigilators':
      sheetData = [
        { 'Invigilator ID': 'INV-01', 'Name': 'Dr. Rachel Green', 'Email': 'rachel@college.edu', 'Department': 'Computer Science', 'Max Workload': 3, 'Availability': 'Day-1-Morning, Day-1-Afternoon, Day-2-Morning' },
        { 'Invigilator ID': 'INV-02', 'Name': 'Prof. Alan Turing', 'Email': 'alan@college.edu', 'Department': 'Mathematics', 'Max Workload': 4, 'Availability': 'Day-1-Afternoon, Day-2-Morning, Day-2-Afternoon' },
      ];
      break;
    case 'courses':
      sheetData = [
        { 'Course ID': 'CS-101', 'Name': 'Intro to Computer Science', 'Duration': 120, 'Priority': 'High', 'Branch': 'Computer Science' },
        { 'Course ID': 'MATH-201', 'Name': 'Linear Algebra', 'Duration': 180, 'Priority': 'Medium', 'Branch': 'Mathematics' },
        { 'Course ID': 'PHY-302', 'Name': 'Quantum Mechanics', 'Duration': 120, 'Priority': 'High', 'Branch': 'Physics' },
      ];
      break;
    case 'rooms':
      sheetData = [
        { 'Room ID': 'R-101', 'Name': 'Main Auditorium', 'Capacity': 80, 'Building': 'Main Hall', 'Accessible': 'Yes' },
        { 'Room ID': 'R-102', 'Name': 'Science Lab', 'Capacity': 30, 'Building': 'Science Tower', 'Accessible': 'No' },
        { 'Room ID': 'R-103', 'Name': 'Seminar Room 1A', 'Capacity': 15, 'Building': 'West Annex', 'Accessible': 'Yes' },
      ];
      break;
    default:
      return res.status(400).json({ error: 'Invalid template type. Use: students, invigilators, courses, rooms' });
  }

  const ws = XLSX.utils.json_to_sheet(sheetData);
  
  // Auto-size columns
  const maxWidths = Object.keys(sheetData[0]).map(key => {
    return Math.max(key.length, ...sheetData.map(row => String(row[key] || '').length));
  });
  ws['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

  XLSX.utils.book_append_sheet(wb, ws, type.charAt(0).toUpperCase() + type.slice(1));

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
  res.send(buf);
});

export default router;
