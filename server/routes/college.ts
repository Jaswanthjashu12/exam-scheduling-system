import { Router } from 'express';
import { getCollege, updateCollege } from '../db';

const router = Router();

// GET /api/college
router.get('/', (req, res, next) => {
  try {
    const info = getCollege();
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// PUT /api/college
router.put('/', (req, res, next) => {
  try {
    const { name, examStartDate } = req.body;
    if (!name || !examStartDate) {
      return res.status(400).json({ error: 'name and examStartDate are required' });
    }
    updateCollege(name, examStartDate);
    res.json({ name, examStartDate });
  } catch (err) {
    next(err);
  }
});

export default router;
