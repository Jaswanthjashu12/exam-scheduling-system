import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { Course, Room, Student, Invigilator, ScheduleEntry, AccommodationType } from '../src/types';

let firestore: Firestore;

const initFirebase = () => {
  if (getApps().length > 0) {
    firestore = getFirestore();
    return;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json';
    const resolvedPath = path.resolve(serviceAccountPath);

    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[Firebase] Initialized with service account credentials from file:', serviceAccountPath);
    } else {
      // Fallback to Application Default Credentials
      initializeApp({
        credential: applicationDefault()
      });
      console.log('[Firebase] Initialized with Application Default Credentials');
    }
    firestore = getFirestore();
  } catch (err: any) {
    console.error('[Firebase] Initialization failed:', err.message);
    console.error('[Firebase] Please place your service account key JSON at "./firebase-key.json" or set FIREBASE_SERVICE_ACCOUNT_PATH in your .env file.');
    // Initialize empty firestore reference to prevent immediate crashes, calls will fail with setup instructions
    firestore = null as any;
  }
};

initFirebase();

const checkDbReady = () => {
  if (!firestore) {
    throw new Error('Firebase Firestore is not initialized. Please ensure your credentials are set up at "firebase-key.json" or in environment variables.');
  }
};

export async function initDatabase(): Promise<void> {
  checkDbReady();

  // Seed default college info if empty
  const collegeRef = firestore.collection('colleges').doc('college_info');
  const collegeDoc = await collegeRef.get();
  if (!collegeDoc.exists) {
    await collegeRef.set({
      name: 'State Institute of Technology',
      examStartDate: '2026-06-15'
    });
    console.log('[Firebase] Seeded default college info');
  }

  // Seed default branches if empty
  const branchesSnapshot = await firestore.collection('branches').get();
  if (branchesSnapshot.empty) {
    const defaultBranches = [
      'Computer Science',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Information Technology',
      'Civil Engineering'
    ];
    const batch = firestore.batch();
    for (const b of defaultBranches) {
      const docRef = firestore.collection('branches').doc(b);
      batch.set(docRef, { name: b });
    }
    await batch.commit();
    console.log('[Firebase] Seeded default engineering branches');
  }
}

// ==========================================
// COURSE CRUD
// ==========================================

export async function getAllCourses(): Promise<Course[]> {
  checkDbReady();
  const snapshot = await firestore.collection('courses').get();
  return snapshot.docs.map(doc => doc.data() as Course);
}

export async function getCourse(id: string): Promise<Course | undefined> {
  checkDbReady();
  const doc = await firestore.collection('courses').doc(id).get();
  return doc.exists ? (doc.data() as Course) : undefined;
}

export async function createCourse(course: Course): Promise<Course> {
  checkDbReady();
  await firestore.collection('courses').doc(course.id).set(course);
  return course;
}

export async function updateCourse(id: string, course: Partial<Course>): Promise<Course> {
  checkDbReady();
  const current = await getCourse(id);
  if (!current) throw new Error(`Course with ID ${id} not found`);
  const updated = { ...current, ...course };
  await firestore.collection('courses').doc(id).update(course);
  return updated;
}

export async function deleteCourse(id: string): Promise<void> {
  checkDbReady();
  await firestore.collection('courses').doc(id).delete();
}

// ==========================================
// ROOM CRUD
// ==========================================

export async function getAllRooms(): Promise<Room[]> {
  checkDbReady();
  const snapshot = await firestore.collection('rooms').get();
  return snapshot.docs.map(doc => doc.data() as Room);
}

export async function getRoom(id: string): Promise<Room | undefined> {
  checkDbReady();
  const doc = await firestore.collection('rooms').doc(id).get();
  return doc.exists ? (doc.data() as Room) : undefined;
}

export async function createRoom(room: Room): Promise<Room> {
  checkDbReady();
  await firestore.collection('rooms').doc(room.id).set(room);
  return room;
}

export async function updateRoom(id: string, room: Partial<Room>): Promise<Room> {
  checkDbReady();
  const current = await getRoom(id);
  if (!current) throw new Error(`Room with ID ${id} not found`);
  const updated = { ...current, ...room };
  await firestore.collection('rooms').doc(id).update(room);
  return updated;
}

export async function deleteRoom(id: string): Promise<void> {
  checkDbReady();
  
  // Nullify room references in schedule entries
  const entriesSnapshot = await firestore.collection('schedule_entries').where('roomId', '==', id).get();
  if (!entriesSnapshot.empty) {
    const batch = firestore.batch();
    entriesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { roomId: null });
    });
    await batch.commit();
  }

  await firestore.collection('rooms').doc(id).delete();
}

// ==========================================
// STUDENT CRUD
// ==========================================

export async function getAllStudents(): Promise<Student[]> {
  checkDbReady();
  const snapshot = await firestore.collection('students').get();
  return snapshot.docs.map(doc => doc.data() as Student);
}

export async function getStudent(id: string): Promise<Student | undefined> {
  checkDbReady();
  const doc = await firestore.collection('students').doc(id).get();
  return doc.exists ? (doc.data() as Student) : undefined;
}

export async function createStudent(student: Student): Promise<Student> {
  checkDbReady();
  
  // Filter course IDs to only those that exist in courses collection
  const coursesSnapshot = await firestore.collection('courses').get();
  const existingCourseIds = new Set(coursesSnapshot.docs.map(doc => doc.id));
  const validCourses = student.courses.filter(cId => existingCourseIds.has(cId));

  const finalStudent: Student = {
    id: student.id,
    name: student.name,
    email: student.email || undefined,
    courses: validCourses,
    accommodations: student.accommodations,
    year: student.year || 1
  };

  await firestore.collection('students').doc(student.id).set(finalStudent);
  return finalStudent;
}

export async function updateStudent(id: string, student: Partial<Student>): Promise<Student> {
  checkDbReady();
  const current = await getStudent(id);
  if (!current) throw new Error(`Student with ID ${id} not found`);

  const updated: Student = {
    ...current,
    ...student,
    email: student.email === null ? undefined : (student.email || current.email)
  };

  if (student.courses) {
    const coursesSnapshot = await firestore.collection('courses').get();
    const existingCourseIds = new Set(coursesSnapshot.docs.map(doc => doc.id));
    updated.courses = student.courses.filter(cId => existingCourseIds.has(cId));
  }

  await firestore.collection('students').doc(id).set(updated);
  return updated;
}

export async function deleteStudent(id: string): Promise<void> {
  checkDbReady();
  await firestore.collection('students').doc(id).delete();
}

// Helper query for sending notification emails
export async function getStudentsByCourse(courseId: string): Promise<{ id: string; name: string; email: string }[]> {
  checkDbReady();
  const snapshot = await firestore.collection('students')
    .where('courses', 'array-contains', courseId)
    .get();

  return snapshot.docs
    .map(doc => doc.data() as Student)
    .filter(s => s.email !== undefined && s.email !== '')
    .map(s => ({
      id: s.id,
      name: s.name,
      email: s.email!
    }));
}

// ==========================================
// INVIGILATOR CRUD
// ==========================================

export async function getAllInvigilators(): Promise<Invigilator[]> {
  checkDbReady();
  const snapshot = await firestore.collection('invigilators').get();
  return snapshot.docs.map(doc => doc.data() as Invigilator);
}

export async function getInvigilator(id: string): Promise<Invigilator | undefined> {
  checkDbReady();
  const doc = await firestore.collection('invigilators').doc(id).get();
  return doc.exists ? (doc.data() as Invigilator) : undefined;
}

export async function createInvigilator(inv: Invigilator): Promise<Invigilator> {
  checkDbReady();
  await firestore.collection('invigilators').doc(inv.id).set(inv);
  return inv;
}

export async function updateInvigilator(id: string, inv: Partial<Invigilator>): Promise<Invigilator> {
  checkDbReady();
  const current = await getInvigilator(id);
  if (!current) throw new Error(`Invigilator with ID ${id} not found`);

  const updated: Invigilator = {
    ...current,
    ...inv,
    email: inv.email === null ? undefined : (inv.email || current.email)
  };

  await firestore.collection('invigilators').doc(id).set(updated);
  return updated;
}

export async function deleteInvigilator(id: string): Promise<void> {
  checkDbReady();
  
  // Nullify invigilator references in schedule entries
  const entriesSnapshot = await firestore.collection('schedule_entries').where('invigilatorId', '==', id).get();
  if (!entriesSnapshot.empty) {
    const batch = firestore.batch();
    entriesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { invigilatorId: null });
    });
    await batch.commit();
  }

  await firestore.collection('invigilators').doc(id).delete();
}

// ==========================================
// SCHEDULE ENTRIES CRUD
// ==========================================

export async function getAllScheduleEntries(): Promise<ScheduleEntry[]> {
  checkDbReady();
  const snapshot = await firestore.collection('schedule_entries').get();
  return snapshot.docs.map(doc => doc.data() as ScheduleEntry);
}

export async function createScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry> {
  checkDbReady();
  await firestore.collection('schedule_entries').doc(entry.id).set(entry);
  return entry;
}

export async function updateScheduleEntry(id: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry> {
  checkDbReady();
  const doc = await firestore.collection('schedule_entries').doc(id).get();
  if (!doc.exists) throw new Error(`Schedule entry with ID ${id} not found`);

  const current = doc.data() as ScheduleEntry;
  const updated: ScheduleEntry = {
    ...current,
    ...entry,
    timeslotId: entry.timeslotId === null ? undefined : (entry.timeslotId || current.timeslotId),
    roomId: entry.roomId === null ? undefined : (entry.roomId || current.roomId),
    invigilatorId: entry.invigilatorId === null ? undefined : (entry.invigilatorId || current.invigilatorId)
  };

  await firestore.collection('schedule_entries').doc(id).set(updated);
  return updated;
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  checkDbReady();
  await firestore.collection('schedule_entries').doc(id).delete();
}

export async function clearScheduleEntries(): Promise<void> {
  checkDbReady();
  const snapshot = await firestore.collection('schedule_entries').get();
  if (snapshot.empty) return;

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function bulkReplaceScheduleEntries(entries: ScheduleEntry[]): Promise<ScheduleEntry[]> {
  checkDbReady();
  
  const coursesSnapshot = await firestore.collection('courses').get();
  const existingCourseIds = new Set(coursesSnapshot.docs.map(doc => doc.id));

  // Clear existing entries
  await clearScheduleEntries();

  if (entries.length === 0) return [];

  // Write new entries in batches (Firestore allows max 500 writes per batch)
  const batchLimit = 400;
  let batch = firestore.batch();
  let count = 0;

  for (const entry of entries) {
    if (!existingCourseIds.has(entry.courseId)) continue; // skip orphans

    const ref = firestore.collection('schedule_entries').doc(entry.id);
    batch.set(ref, {
      id: entry.id,
      courseId: entry.courseId,
      timeslotId: entry.timeslotId || null,
      roomId: entry.roomId || null,
      invigilatorId: entry.invigilatorId || null
    });

    count++;
    if (count >= batchLimit) {
      await batch.commit();
      batch = firestore.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return entries;
}

// ==========================================
// BRANCHES CRUD
// ==========================================

export async function getAllBranches(): Promise<string[]> {
  checkDbReady();
  const snapshot = await firestore.collection('branches').get();
  return snapshot.docs.map(doc => doc.id).sort();
}

export async function addBranch(name: string): Promise<void> {
  checkDbReady();
  await firestore.collection('branches').doc(name).set({ name });
}

export async function deleteBranch(name: string): Promise<void> {
  checkDbReady();
  await firestore.collection('branches').doc(name).delete();
}

// ==========================================
// COLLEGE INFO
// ==========================================

export async function getCollege(): Promise<{ name: string; examStartDate: string }> {
  checkDbReady();
  const doc = await firestore.collection('colleges').doc('college_info').get();
  if (!doc.exists) {
    return { name: 'State Institute of Technology', examStartDate: '2026-06-15' };
  }
  const data = doc.data() as any;
  return {
    name: data.name,
    examStartDate: data.examStartDate
  };
}

export async function updateCollege(name: string, examStartDate: string): Promise<void> {
  checkDbReady();
  await firestore.collection('colleges').doc('college_info').set({ name, examStartDate });
}
