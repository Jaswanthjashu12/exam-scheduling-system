import { Router } from 'express';
import { getAllInvigilators, getInvigilator, createInvigilator, updateInvigilator, deleteInvigilator } from '../db';
import { Invigilator } from '../../src/types';

const router = Router();

// GET /api/invigilators
router.get('/', async (req, res, next) => {
  try {
    const invigilators = await getAllInvigilators();
    res.json(invigilators);
  } catch (err) {
    next(err);
  }
});

// GET /api/invigilators/:id
router.get('/:id', async (req, res, next) => {
  try {
    const invigilator = await getInvigilator(req.params.id);
    if (!invigilator) {
      return res.status(404).json({ error: 'Invigilator not found' });
    }
    res.json(invigilator);
  } catch (err) {
    next(err);
  }
});

// POST /api/invigilators
router.post('/', async (req, res, next) => {
  try {
    const { id, name, email, department, availability, maxWorkload } = req.body;
    const dept = department || 'General';
    if (!id || !name || maxWorkload === undefined) {
      return res.status(400).json({ error: 'id, name, and maxWorkload are required' });
    }

    const newInvigilator: Invigilator = {
      id,
      name,
      email: email || undefined,
      department: dept,
      availability: availability || [],
      maxWorkload
    };

    const created = await createInvigilator(newInvigilator);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `Invigilator with ID already exists` });
    }
    next(err);
  }
});

// PUT /api/invigilators/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, department, availability, maxWorkload } = req.body;
    const updated = await updateInvigilator(req.params.id, { 
      name, 
      email, 
      department: department || 'General', 
      availability, 
      maxWorkload 
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/invigilators/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteInvigilator(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
