import { Course, Room, Student, Invigilator, ScheduleEntry, ConflictReport } from "../../src/types";
import { 
  getAllCourses, 
  getAllRooms, 
  getAllStudents, 
  getAllInvigilators, 
  getAllScheduleEntries 
} from "../db";
import { buildEnrollmentIndex, getCourseEnrollment, getConflictReport } from "../solver";

export interface ExamConstraints {
  exams: {
    id: string;
    courseId: string;
    courseName: string;
    timeslotId: string;
    roomId: string;
    invigilatorId: string;
    studentCount: number;
    year: number;
    branch: string;
  }[];
  rooms: {
    id: string;
    name: string;
    capacity: number;
    building: string;
    accessible: boolean;
  }[];
  students: {
    id: string;
    name: string;
    branch: string;
    year: number;
    accommodations: string[];
    courses: string[];
  }[];
  proctors: {
    id: string;
    name: string;
    department: string;
    availability: string[];
    assignedExams: string[];
  }[];
  conflicts: ConflictReport[];
}

export async function buildConstraints(): Promise<ExamConstraints> {
  const [courses, rooms, students, invigilators, entries] = await Promise.all([
    getAllCourses(),
    getAllRooms(),
    getAllStudents(),
    getAllInvigilators(),
    getAllScheduleEntries(),
  ]);

  const eIdx = buildEnrollmentIndex(students);

  const proctorAssignments = new Map<string, string[]>();
  entries.forEach(e => {
    if (!e.invigilatorId) return;
    const ids = e.invigilatorId.split(",").map(id => id.trim()).filter(Boolean);
    ids.forEach(invId => {
      const assigned = proctorAssignments.get(invId) || [];
      assigned.push(e.courseId);
      proctorAssignments.set(invId, assigned);
    });
  });

  const exams = entries.map(e => {
    const course = courses.find(c => c.id === e.courseId);
    const count = getCourseEnrollment(e.courseId, students, eIdx).length;
    return {
      id: e.id,
      courseId: e.courseId,
      courseName: course?.name || "",
      timeslotId: e.timeslotId || "",
      roomId: e.roomId || "",
      invigilatorId: e.invigilatorId || "",
      studentCount: count,
      year: course?.year || 1,
      branch: course?.branch || "General Academic",
    };
  });

  const roomsList = rooms.map(r => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    building: r.building,
    accessible: !!r.accessible,
  }));

  const studentsList = students.map(s => ({
    id: s.id,
    name: s.name,
    branch: s.branch || "",
    year: s.year || 1,
    accommodations: s.accommodations || [],
    courses: s.courses || [],
  }));

  const proctorsList = invigilators.map(i => ({
    id: i.id,
    name: i.name,
    department: i.department,
    availability: i.availability || [],
    assignedExams: proctorAssignments.get(i.id) || [],
  }));

  const conflicts = getConflictReport(entries, courses, students, rooms, invigilators);

  return {
    exams,
    rooms: roomsList,
    students: studentsList,
    proctors: proctorsList,
    conflicts,
  };
}
