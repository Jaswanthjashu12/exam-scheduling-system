import { Router } from 'express';
import { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent } from '../db';
import { Student } from '../../src/types';

const router = Router();

// GET /api/students
router.get('/', (req, res, next) => {
  try {
    const students = getAllStudents();
    res.json(students);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:id
router.get('/:id', (req, res, next) => {
  try {
    const student = getStudent(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// POST /api/students
router.post('/', (req, res, next) => {
  try {
    const { id, name, email, courses, accommodations } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    const newStudent: Student = {
      id,
      name,
      email: email || undefined,
      courses: courses || [],
      accommodations: accommodations || []
    };

    const created = createStudent(newStudent);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `Student with ID already exists` });
    }
    next(err);
  }
});

// PUT /api/students/:id
router.put('/:id', (req, res, next) => {
  try {
    const { name, email, courses, accommodations } = req.body;
    const updated = updateStudent(req.params.id, { name, email, courses, accommodations });
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/students/:id
router.delete('/:id', (req, res, next) => {
  try {
    deleteStudent(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
