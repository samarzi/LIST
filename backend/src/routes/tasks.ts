import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  reminderTime: z.string().datetime().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
  reminderTime: z.string().datetime().optional(),
});

// Get all tasks for current user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(tasks.map(t => ({
    id: Number(t.id),
    title: t.title,
    description: t.description,
    completed: t.completed,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  })));
});

// Create a new task
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  console.log('=== Creating task ===');
  console.log('User ID:', userId);
  console.log('Request body:', JSON.stringify(req.body));
  console.log('Request headers:', JSON.stringify(req.headers));
  
  const parsed = CreateTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    console.log('Task validation failed:', parsed.error.flatten());
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  console.log('Validation passed, creating task...');
  
  try {
    const task = await prisma.task.create({
      data: {
        userId,
        title: parsed.data.title,
        description: parsed.data.description,
      },
    });

    console.log('Task created successfully:', task.id);
    return res.status(201).json({
      id: Number(task.id),
      title: task.title,
      description: task.description,
      completed: task.completed,
      completedAt: task.completedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const taskId = BigInt(req.params.id);
  const parsed = UpdateTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Verify task belongs to user
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updateData: any = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.completed !== undefined) {
    updateData.completed = parsed.data.completed;
    updateData.completedAt = parsed.data.completed ? new Date() : null;
  }
  if (parsed.data.reminderTime !== undefined) {
    updateData.reminderTime = parsed.data.reminderTime ? new Date(parsed.data.reminderTime) : null;
    updateData.reminderSent = false; // Reset reminder sent flag when time changes
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  return res.json({
    id: Number(task.id),
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completedAt,
    reminderTime: task.reminderTime,
    reminderSent: task.reminderSent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });
});

// Delete a task
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const taskId = BigInt(req.params.id);

  // Verify task belongs to user
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  return res.json({ success: true });
});

export default router;
