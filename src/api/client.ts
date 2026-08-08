import { Course, Room, Student, Invigilator, ScheduleEntry } from '../types';

const API_BASE = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  // For 204 No Content, return empty/undefined
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return res.json();
}

// ==========================================
// COURSES
// ==========================================
export async function fetchCourses(): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/api/courses`);
  return handleResponse<Course[]>(res);
}

export async function createCourse(course: Course): Promise<Course> {
  const res = await fetch(`${API_BASE}/api/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course)
  });
  return handleResponse<Course>(res);
}

export async function updateCourse(id: string, course: Partial<Course>): Promise<Course> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course)
  });
  return handleResponse<Course>(res);
}

export async function deleteCourse(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function replaceAllCourses(courses: Course[]): Promise<void> {
  const current = await fetchCourses();
  // Delete removed ones
  for (const c of current) {
    if (!courses.find(nc => nc.id === c.id)) {
      await deleteCourse(c.id);
    }
  }
  // Create or update
  for (const c of courses) {
    if (current.find(cc => cc.id === c.id)) {
      await updateCourse(c.id, c);
    } else {
      await createCourse(c);
    }
  }
}

// ==========================================
// ROOMS
// ==========================================
export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/api/rooms`);
  return handleResponse<Room[]>(res);
}

export async function createRoom(room: Room): Promise<Room> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room)
  });
  return handleResponse<Room>(res);
}

export async function updateRoom(id: string, room: Partial<Room>): Promise<Room> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room)
  });
  return handleResponse<Room>(res);
}

export async function deleteRoom(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function replaceAllRooms(rooms: Room[]): Promise<void> {
  const current = await fetchRooms();
  // Delete removed ones
  for (const r of current) {
    if (!rooms.find(nr => nr.id === r.id)) {
      await deleteRoom(r.id);
    }
  }
  // Create or update
  for (const r of rooms) {
    if (current.find(cr => cr.id === r.id)) {
      await updateRoom(r.id, r);
    } else {
      await createRoom(r);
    }
  }
}

// ==========================================
// STUDENTS
// ==========================================
export async function fetchStudents(): Promise<Student[]> {
  const res = await fetch(`${API_BASE}/api/students`);
  return handleResponse<Student[]>(res);
}

export async function createStudent(student: Student): Promise<Student> {
  const res = await fetch(`${API_BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });
  return handleResponse<Student>(res);
}

export async function updateStudent(id: string, student: Partial<Student>): Promise<Student> {
  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });
  return handleResponse<Student>(res);
}

export async function deleteStudent(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function replaceAllStudents(students: Student[]): Promise<void> {
  const current = await fetchStudents();
  // Delete removed ones
  for (const s of current) {
    if (!students.find(ns => ns.id === s.id)) {
      await deleteStudent(s.id);
    }
  }
  // Create or update
  for (const s of students) {
    if (current.find(cs => cs.id === s.id)) {
      await updateStudent(s.id, s);
    } else {
      await createStudent(s);
    }
  }
}

// ==========================================
// INVIGILATORS
// ==========================================
export async function fetchInvigilators(): Promise<Invigilator[]> {
  const res = await fetch(`${API_BASE}/api/invigilators`);
  return handleResponse<Invigilator[]>(res);
}

export async function createInvigilator(invigilator: Invigilator): Promise<Invigilator> {
  const res = await fetch(`${API_BASE}/api/invigilators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invigilator)
  });
  return handleResponse<Invigilator>(res);
}

export async function updateInvigilator(id: string, invigilator: Partial<Invigilator>): Promise<Invigilator> {
  const res = await fetch(`${API_BASE}/api/invigilators/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invigilator)
  });
  return handleResponse<Invigilator>(res);
}

export async function deleteInvigilator(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/invigilators/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function replaceAllInvigilators(invs: Invigilator[]): Promise<void> {
  const current = await fetchInvigilators();
  // Delete removed ones
  for (const i of current) {
    if (!invs.find(ni => ni.id === i.id)) {
      await deleteInvigilator(i.id);
    }
  }
  // Create or update
  for (const i of invs) {
    if (current.find(ci => ci.id === i.id)) {
      await updateInvigilator(i.id, i);
    } else {
      await createInvigilator(i);
    }
  }
}

// ==========================================
// SCHEDULE ENTRIES
// ==========================================
export async function fetchSchedule(): Promise<ScheduleEntry[]> {
  const res = await fetch(`${API_BASE}/api/schedule`);
  return handleResponse<ScheduleEntry[]>(res);
}

export async function createScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry> {
  const res = await fetch(`${API_BASE}/api/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
  return handleResponse<ScheduleEntry>(res);
}

export async function updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry> {
  const res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
  return handleResponse<ScheduleEntry>(res);
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/schedule/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function bulkReplaceSchedule(entries: ScheduleEntry[]): Promise<ScheduleEntry[]> {
  const res = await fetch(`${API_BASE}/api/schedule/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries)
  });
  return handleResponse<ScheduleEntry[]>(res);
}

export async function clearSchedule(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/schedule/clear`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

// ==========================================
// BRANCHES
// ==========================================
export async function fetchBranches(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/branches`);
  return handleResponse<string[]>(res);
}

export async function addBranch(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return handleResponse<void>(res);
}

export async function removeBranch(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/branches/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  return handleResponse<void>(res);
}

export async function replaceAllBranches(branches: string[]): Promise<void> {
  const current = await fetchBranches();
  // Delete removed ones
  for (const b of current) {
    if (!branches.includes(b)) {
      await removeBranch(b);
    }
  }
  // Add new ones
  for (const b of branches) {
    if (!current.includes(b)) {
      await addBranch(b);
    }
  }
}

// ==========================================
// COLLEGE INFO
// ==========================================
export async function fetchCollege(): Promise<{ name: string; examStartDate: string }> {
  const res = await fetch(`${API_BASE}/api/college`);
  return handleResponse<{ name: string; examStartDate: string }>(res);
}

export async function updateCollegeMeta(name: string, examStartDate: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/college`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, examStartDate })
  });
  return handleResponse<void>(res);
}

// ==========================================
// OPTIMIZER
// ==========================================
export async function runServerOptimizer(
  strategy: 'heuristic' | 'sequential', 
  maxIterations?: number,
  strictBranchSeparation?: boolean
): Promise<{ entries: ScheduleEntry[]; metrics: any }> {
  const res = await fetch(`${API_BASE}/api/optimizer/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy, maxIterations, strictBranchSeparation })
  });
  return handleResponse<{ entries: ScheduleEntry[]; metrics: any }>(res);
}

export async function evaluateServerSchedule(): Promise<{ metrics: any; conflicts: any[] }> {
  const res = await fetch(`${API_BASE}/api/optimizer/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return handleResponse<{ metrics: any; conflicts: any[] }>(res);
}

export async function sendSeatingPlan(payload: {
  invigilatorId: string;
  timeslotId: string;
  roomId: string;
  timeslotLabel: string;
  roomLabel: string;
  seatingGrid: any[];
  riskCount: number;
  singleExamRoom: boolean;
}): Promise<{ message: string; url?: string }> {
  const res = await fetch(`${API_BASE}/api/schedule/send-seating-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<{ message: string; url?: string }>(res);
}

export async function sendStudentSeatNotifications(payload: {
  timeslotLabel: string;
  roomLabel: string;
  collegeName?: string;
  seatingGrid: any[];
  singleExamRoom: boolean;
}): Promise<{ message: string; sentCount: number; failedCount: number; url?: string }> {
  const res = await fetch(`${API_BASE}/api/schedule/send-student-seat-notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<{ message: string; sentCount: number; failedCount: number; url?: string }>(res);
}

export async function notifyExamAssignment(payload: {
  courseId: string;
  courseName?: string;
  timeslotLabel?: string;
  roomLabel?: string;
  collegeName?: string;
}): Promise<{ message: string; sentCount: number; failedCount: number; url?: string }> {
  const res = await fetch(`${API_BASE}/api/schedule/notify-exam-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<{ message: string; sentCount: number; failedCount: number; url?: string }>(res);
}
