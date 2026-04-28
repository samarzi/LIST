import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const CreateHabitSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  targetDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
  reminderTime: z.string().datetime().optional(),
});

const UpdateHabitSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  targetDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  reminderTime: z.string().datetime().optional(),
});

// Get all habits for current user with today's tracking
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const habits = await prisma.habit.findMany({
    where: { userId },
    include: {
      trackings: {
        where: { date: today },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(habits.map(h => ({
    id: Number(h.id),
    title: h.title,
    reminderTime: h.reminderTime,
    reminderSent: h.reminderSent,
    description: h.description,
    targetDays: h.targetDays,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    completedToday: h.trackings.length > 0 && h.trackings[0].completed,
  })));
});

// Create a new habit
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  console.log('Creating habit for user:', userId, 'body:', req.body);
  const parsed = CreateHabitSchema.safeParse(req.body);

  if (!parsed.success) {
    console.log('Habit validation failed:', parsed.error.flatten());
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const habit = await prisma.habit.create({
    data: {
      userId,
      title: parsed.data.title,
      description: parsed.data.description,
      targetDays: parsed.data.targetDays,
    },
  });

  console.log('Habit created:', habit.id);
  return res.status(201).json({
    id: Number(habit.id),
    title: habit.title,
    description: habit.description,
    targetDays: habit.targetDays,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
    completedToday: false,
  });
});

// Update a habit
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const habitId = BigInt(req.params.id);
  const parsed = UpdateHabitSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Verify habit belongs to user
  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const updateData: any = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.targetDays !== undefined) updateData.targetDays = parsed.data.targetDays;
  if (parsed.data.reminderTime !== undefined) {
    updateData.reminderTime = parsed.data.reminderTime ? new Date(parsed.data.reminderTime) : null;
    updateData.reminderSent = false; // Reset reminder sent flag when time changes
  }

  const habit = await prisma.habit.update({
    where: { id: habitId },
    data: updateData,
  });

  return res.json({
    id: Number(habit.id),
    title: habit.title,
    description: habit.description,
    targetDays: habit.targetDays,
    reminderTime: habit.reminderTime,
    reminderSent: habit.reminderSent,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
    completedToday: false,
  });
});

// Delete a habit
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const habitId = BigInt(req.params.id);

  // Verify habit belongs to user
  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  await prisma.habit.delete({
    where: { id: habitId },
  });

  return res.json({ success: true });
});

// Toggle habit completion for today
router.post('/:id/toggle', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const habitId = BigInt(req.params.id);

  // Verify habit belongs to user
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });

  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingTracking = await prisma.habitTracking.findUnique({
    where: {
      habitId_date: {
        habitId,
        date: today,
      },
    },
  });

  if (existingTracking) {
    // Toggle existing
    const updated = await prisma.habitTracking.update({
      where: { id: existingTracking.id },
      data: { completed: !existingTracking.completed },
    });
    return res.json({ completed: updated.completed });
  } else {
    // Create new tracking
    const created = await prisma.habitTracking.create({
      data: {
        habitId,
        date: today,
        completed: true,
      },
    });
    return res.json({ completed: created.completed });
  }
});

export default router;
