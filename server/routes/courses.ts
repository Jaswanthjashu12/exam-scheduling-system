import { Router } from 'express';
import { getAllCourses, getCourse, createCourse, updateCourse, deleteCourse } from '../db';
import { Course } from '../../src/types';

const router = Router();

// GET /api/courses
router.get('/', async (req, res, next) => {
  try {
    const courses = await getAllCourses();
    res.json(courses);
  } catch (err) {
    next(err);
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const course = await getCourse(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
  } catch (err) {
    next(err);
  }
});

// POST /api/courses
router.post('/', async (req, res, next) => {
  try {
    const { id, name, duration, priority, branch, year } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }
    
    // Validate priority
    if (priority && !['High', 'Medium', 'Low'].includes(priority)) {
      return res.status(400).json({ error: 'priority must be High, Medium, or Low' });
    }

    // Validate year
    if (year !== undefined && (isNaN(Number(year)) || Number(year) < 1 || Number(year) > 4)) {
      return res.status(400).json({ error: 'year must be between 1 and 4' });
    }

    const newCourse: Course = {
      id,
      name,
      duration: duration || 120,
      priority: priority || 'Medium',
      branch,
      year: year ? Number(year) : 1
    };

    const created = await createCourse(newCourse);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `Course with ID already exists` });
    }
    next(err);
  }
});

// PUT /api/courses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, duration, priority, branch, year } = req.body;
    
    // Validate year
    if (year !== undefined && (isNaN(Number(year)) || Number(year) < 1 || Number(year) > 4)) {
      return res.status(400).json({ error: 'year must be between 1 and 4' });
    }

    const updated = await updateCourse(req.params.id, { name, duration, priority, branch, year: year ? Number(year) : undefined });
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/courses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteCourse(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
