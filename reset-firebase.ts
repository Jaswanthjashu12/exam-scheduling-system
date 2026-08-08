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
      { id: "23IT301", name: "Information Technology", duration: 120, priority: "High", branch: "Computer Science & Eng", year: 3 },
      { id: "ENG-220", name: "Advanced Engineering Design", duration: 180, priority: "High", branch: "Mechanical Engineering", year: 4 },
    ];

    const rooms = [
      { id: "RM-101", name: "Grand Exhibition Hall", capacity: 50, building: "Science Block A", block: "Block 1", accessible: true },
      { id: "RM-204", name: "Advanced Computing Lab", capacity: 25, building: "Turing Plaza", block: "Block 2", accessible: true },
      { id: "RM-305", name: "General Lecture Room", capacity: 30, building: "Liberal Arts Wing", block: "Block 3", accessible: false },
      { id: "RM-12", name: "Scribe Annex Room 3", capacity: 10, building: "Administration Ground", block: "Block 4", accessible: true },
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
