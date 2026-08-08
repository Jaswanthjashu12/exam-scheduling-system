import { Router } from 'express';
import { getCollege, updateCollege } from '../db';

const router = Router();

// GET /api/college
router.get('/', async (req, res, next) => {
  try {
    const info = await getCollege();
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// PUT /api/college
router.put('/', async (req, res, next) => {
  try {
    const { name, examStartDate } = req.body;
    if (!name || !examStartDate) {
      return res.status(400).json({ error: 'name and examStartDate are required' });
    }
    await updateCollege(name, examStartDate);
    res.json({ name, examStartDate });
  } catch (err) {
    next(err);
  }
});

export default router;
