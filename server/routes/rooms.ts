import { Router } from 'express';
import { getAllRooms, getRoom, createRoom, updateRoom, deleteRoom } from '../db';
import { Room } from '../../src/types';

const router = Router();

// GET /api/rooms
router.get('/', async (req, res, next) => {
  try {
    const rooms = await getAllRooms();
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res, next) => {
  try {
    const room = await getRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms
router.post('/', async (req, res, next) => {
  try {
    const { id, name, capacity, building, accessible } = req.body;
    if (!id || !name || capacity === undefined || !building) {
      return res.status(400).json({ error: 'id, name, capacity, and building are required' });
    }

    const newRoom: Room = {
      id,
      name,
      capacity,
      building,
      accessible: !!accessible
    };

    const created = await createRoom(newRoom);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `Room with ID already exists` });
    }
    next(err);
  }
});

// PUT /api/rooms/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, capacity, building, accessible } = req.body;
    const updated = await updateRoom(req.params.id, { name, capacity, building, accessible });
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteRoom(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
