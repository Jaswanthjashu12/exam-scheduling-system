import { Router } from 'express';
import { getAllBranches, addBranch, deleteBranch } from '../db';

const router = Router();

// GET /api/branches
router.get('/', async (req, res, next) => {
  try {
    const branches = await getAllBranches();
    res.json(branches);
  } catch (err) {
    next(err);
  }
});

// POST /api/branches
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    await addBranch(name);
    res.status(201).json({ name });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/branches/:name
router.delete('/:name', async (req, res, next) => {
  try {
    const name = req.params.name;
    await deleteBranch(name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
