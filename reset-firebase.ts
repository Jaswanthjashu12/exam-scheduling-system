import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const initFirebase = () => {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json';
    const resolvedPath = path.resolve(serviceAccountPath);

    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[Firebase] Initialized with Service Account: ', serviceAccountPath);
    } else {
      initializeApp({
        credential: applicationDefault()
      });
      console.log('[Firebase] Initialized with Application Default Credentials');
    }
  } catch (err: any) {
    console.error('[Firebase] Initialization failed:', err.message);
    process.exit(1);
  }
};

initFirebase();
const firestore = getFirestore();

async function deleteCollection(collectionPath: string) {
  const collectionRef = firestore.collection(collectionPath);
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return;

  const batch = firestore.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`- Cleared collection: ${collectionPath}`);
}

async function runReset() {
  try {
    console.log('1. Clearing existing Firestore collections...');
    await deleteCollection('colleges');
    await deleteCollection('branches');
    await deleteCollection('courses');
    await deleteCollection('rooms');
    await deleteCollection('invigilators');
    await deleteCollection('students');
    await deleteCollection('schedule_entries');

    console.log('\n2. Seeding default College Info & Branches...');
    await firestore.collection('colleges').doc('college_info').set({
      name: 'State Institute of Technology',
      examStartDate: '2026-06-15'
    });

    const defaultBranches = [
      'Computer Science & Eng',
      'Electrical & Electronics',
      'Mechanical Engineering',
      'Civil Engineering',
      'Business & Humanities'
    ];
    const branchBatch = firestore.batch();
    for (const name of defaultBranches) {
      const ref = firestore.collection('branches').doc(name);
      branchBatch.set(ref, { name });
    }
    await branchBatch.commit();
    console.log('- Seeded 5 branches');

    // 3. Define Seed Data
    const courses = [
      { id: "CS-101", name: "Introduction to Computer Science", duration: 120, priority: "High", branch: "Computer Science & Eng", year: 1 },
      { id: "MATH-201", name: "Differential Calculus", duration: 180, priority: "High", branch: "Computer Science & Eng", year: 2 },
      { id: "PHY-110", name: "Physics: Optics & Electromagnetism", duration: 120, priority: "Medium", branch: "Electrical & Electronics", year: 1 },
      { id: "CHEM-120", name: "Analytical Organic Chemistry", duration: 150, priority: "Medium", branch: "Business & Humanities", year: 3 },
      { id: "BIO-101", name: "Cellular & Molecular Biology", duration: 120, priority: "Low", branch: "Business & Humanities", year: 2 },
      { id: "LIT-305", name: "Contemporary Literature Studies", duration: 90, priority: "Low", branch: "Business & Humanities", year: 4 },
      { id: "STATS-150", name: "Applied Statistical Science", duration: 120, priority: "High", branch: "Computer Science & Eng", year: 3 },
      { id: "ENG-220", name: "Advanced Engineering Design", duration: 180, priority: "High", branch: "Mechanical Engineering", year: 4 },
    ];

    const rooms = [
      { id: "RM-101", name: "Grand Exhibition Hall", capacity: 50, building: "Science Block A", accessible: true },
      { id: "RM-204", name: "Advanced Computing Lab", capacity: 25, building: "Turing Plaza", accessible: true },
      { id: "RM-305", name: "General Lecture Room", capacity: 30, building: "Liberal Arts Wing", accessible: false },
      { id: "RM-12", name: "Scribe Annex Room 3", capacity: 10, building: "Administration Ground", accessible: true },
    ];

    const invigilators = [
      { id: "INV-101", name: "Dr. Elizabeth Vance", email: "elizabeth.vance@state.edu", department: "Science", maxWorkload: 3, availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning"] },
      { id: "INV-102", name: "Prof. Marcus Brody", email: "marcus.brody@state.edu", department: "Linguistics", maxWorkload: 2, availability: ["Day-1-Morning", "Day-1-Evening", "Day-2-Afternoon", "Day-3-Afternoon"] },
      { id: "INV-103", name: "Dr. Sarah Connor", email: "sarah.connor@state.edu", department: "Mathematics", maxWorkload: 4, availability: ["Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning", "Day-3-Afternoon", "Day-3-Evening"] },
      { id: "INV-104", name: "Dr. Henry Jones", email: "henry.jones@state.edu", department: "History", maxWorkload: 3, availability: ["Day-1-Evening", "Day-2-Morning", "Day-2-Evening", "Day-3-Morning", "Day-3-Evening"] },
      { id: "INV-105", name: "Prof. Rupert Giles", email: "rupert.giles@state.edu", department: "Humanities", maxWorkload: 3, availability: ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-3-Afternoon", "Day-3-Evening"] },
    ];

    const students = [
      { id: "STU-01", name: "Bruce Wayne", email: "gedelapranaya@gmail.com", courses: ["CS-101", "MATH-201", "ENG-220"], accommodations: [], year: 1 },
      { id: "STU-02", name: "Clark Kent", email: "gedelapranaya@gmail.com", courses: ["MATH-201", "PHY-110", "STATS-150"], accommodations: ["extra_time"], year: 2 },
      { id: "STU-03", name: "Diana Prince", email: "gedelapranaya@gmail.com", courses: ["PHY-110", "CHEM-120", "LIT-305"], accommodations: [], year: 1 },
      { id: "STU-04", name: "Barry Allen", email: "gedelapranaya@gmail.com", courses: ["CS-101", "STATS-150"], accommodations: ["separate_room"], year: 3 },
      { id: "STU-05", name: "Arthur Curry", email: "gedelapranaya@gmail.com", courses: ["LIT-305", "BIO-101"], accommodations: ["accessible"], year: 2 },
      { id: "STU-06", name: "Hal Jordan", email: "gedelapranaya@gmail.com", courses: ["ENG-220", "PHY-110"], accommodations: [], year: 4 },
      { id: "STU-07", name: "Victor Stone", email: "gedelapranaya@gmail.com", courses: ["STATS-150", "ENG-220", "CS-101"], accommodations: ["separate_room", "accessible"], year: 3 },
      { id: "STU-08", name: "Oliver Queen", email: "gedelapranaya@gmail.com", courses: ["MATH-201", "CHEM-120"], accommodations: [], year: 2 },
      { id: "STU-09", name: "Selina Kyle", email: "gedelapranaya@gmail.com", courses: ["CS-101", "LIT-305", "BIO-101"], accommodations: ["extra_time"], year: 1 },
      { id: "STU-10", name: "Bruce Banner", email: "gedelapranaya@gmail.com", courses: ["PHY-110", "CHEM-120", "BIO-101"], accommodations: ["separate_room", "scribe"], year: 4 },
      { id: "STU-11", name: "Tony Stark", email: "gedelapranaya@gmail.com", courses: ["STATS-150", "ENG-220", "MATH-201"], accommodations: [], year: 3 },
      { id: "STU-12", name: "Peter Parker", email: "gedelapranaya@gmail.com", courses: ["BIO-101", "MATH-201"], accommodations: ["extra_time"], year: 2 },
      { id: "STU-13", name: "Natasha Romanoff", email: "gedelapranaya@gmail.com", courses: ["CS-101", "STATS-150"], accommodations: [], year: 1 },
      { id: "STU-14", name: "Steve Rogers", email: "gedelapranaya@gmail.com", courses: ["LIT-305", "ENG-220"], accommodations: ["accessible"], year: 4 },
      { id: "STU-15", name: "Wanda Maximoff", email: "gedelapranaya@gmail.com", courses: ["CHEM-120", "PHY-110"], accommodations: ["separate_room"], year: 3 },
    ];

    console.log('\n3. Seeding Courses...');
    const courseBatch = firestore.batch();
    for (const c of courses) {
      const ref = firestore.collection('courses').doc(c.id);
      courseBatch.set(ref, c);
    }
    await courseBatch.commit();
    console.log('- Seeded courses');

    console.log('4. Seeding Rooms...');
    const roomBatch = firestore.batch();
    for (const r of rooms) {
      const ref = firestore.collection('rooms').doc(r.id);
      roomBatch.set(ref, r);
    }
    await roomBatch.commit();
    console.log('- Seeded rooms');

    console.log('5. Seeding Invigilators...');
    const invBatch = firestore.batch();
    for (const inv of invigilators) {
      const ref = firestore.collection('invigilators').doc(inv.id);
      invBatch.set(ref, inv);
    }
    await invBatch.commit();
    console.log('- Seeded invigilators');

    console.log('6. Seeding Students...');
    const stuBatch = firestore.batch();
    for (const s of students) {
      const ref = firestore.collection('students').doc(s.id);
      stuBatch.set(ref, s);
    }
    await stuBatch.commit();
    console.log('- Seeded students');

    console.log('7. Seeding Schedule Entries (Greedy Draft)...');
    const entryBatch = firestore.batch();
    const timeslots = ["Day-1-Morning", "Day-1-Afternoon", "Day-2-Morning", "Day-2-Afternoon", "Day-3-Morning"];
    courses.forEach((crs, index) => {
      const id = `ent_${crs.id}`;
      const ref = firestore.collection('schedule_entries').doc(id);
      entryBatch.set(ref, {
        id,
        courseId: crs.id,
        timeslotId: timeslots[index % timeslots.length],
        roomId: rooms[index % rooms.length].id,
        invigilatorId: invigilators[index % invigilators.length].id
      });
    });
    await entryBatch.commit();
    console.log('- Seeded schedule entries');

    console.log('\nFirebase Firestore reset and seed completed successfully!');
    process.exit(0);
  } catch (err: any) {
    console.error('Reset and seed failed:', err.message);
    process.exit(1);
  }
}

runReset();
