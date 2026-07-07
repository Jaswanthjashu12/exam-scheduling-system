import { Router } from 'express';
import { 
  getAllCourses, 
  getAllStudents, 
  getAllRooms, 
  getAllInvigilators, 
  getAllScheduleEntries, 
  bulkReplaceScheduleEntries 
} from '../db';
import { 
  runOptimization, 
  runSimpleSequentialAllocation, 
  evaluateSchedule, 
  getConflictReport,
  DEFAULT_WEIGHTS
} from '../solver';
import { ScheduleEntry } from '../../src/types';

const router = Router();

// POST /api/optimizer/run
router.post('/run', async (req, res, next) => {
  try {
    const { strategy, maxIterations, strictBranchSeparation } = req.body;
    
    // Fetch all current database data
    const courses = await getAllCourses();
    const students = await getAllStudents();
    const rooms = await getAllRooms();
    const invigilators = await getAllInvigilators();

    let entries: ScheduleEntry[] = [];
    const isStrict = !!strictBranchSeparation;

    if (strategy === 'sequential') {
      entries = runSimpleSequentialAllocation(courses, students, rooms, invigilators, isStrict);
    } else {
      // Default to heuristic (Simulated Annealing)
      const iterations = typeof maxIterations === 'number' ? maxIterations : 800;
      const weights = { ...DEFAULT_WEIGHTS, strictBranchSeparation: isStrict };
      entries = runOptimization(
        courses, 
        students, 
        rooms, 
        invigilators, 
        weights, 
        () => {}, // dummy onProgress callback
        iterations
      );
    }

    // Save generated schedule to DB
    await bulkReplaceScheduleEntries(entries);

    // Evaluate the final schedule
    const weights = { ...DEFAULT_WEIGHTS, strictBranchSeparation: isStrict };
    const metrics = evaluateSchedule(entries, courses, students, rooms, invigilators, weights);

    res.json({ entries, metrics });
  } catch (err) {
    next(err);
  }
});

// POST /api/optimizer/evaluate
router.post('/evaluate', async (req, res, next) => {
  try {
    const courses = await getAllCourses();
    const students = await getAllStudents();
    const rooms = await getAllRooms();
    const invigilators = await getAllInvigilators();
    const entries = await getAllScheduleEntries();

    const metrics = evaluateSchedule(entries, courses, students, rooms, invigilators, DEFAULT_WEIGHTS);
    const conflicts = getConflictReport(entries, courses, students, rooms, invigilators, DEFAULT_WEIGHTS);

    res.json({ metrics, conflicts });
  } catch (err) {
    next(err);
  }
});

export default router;
