import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  deadline: z.string().datetime().optional(),
  reminderTime: z.string().datetime().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
  deadline: z.string().datetime().nullable().optional(),
  reminderTime: z.string().datetime().optional(),
});

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
});

const UpdateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

function serializeTask(task: any) {
  return {
    id: Number(task.id),
    title: task.title,
    description: task.description,
    completed: task.completed,
    completedAt: task.completedAt,
    deadline: task.deadline,
    reminderTime: task.reminderTime,
    reminderSent: task.reminderSent,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    subtasks: (task.subtasks ?? []).map((s: any) => ({
      id: Number(s.id),
      title: s.title,
      completed: s.completed,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  };
}

// Get all tasks for current user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const archived = req.query.archived === 'true';

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      archivedAt: archived ? { not: null } : null,
    },
    include: {
      subtasks: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(tasks.map(serializeTask));
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
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        reminderTime: parsed.data.reminderTime ? new Date(parsed.data.reminderTime) : null,
      },
      include: {
        subtasks: { orderBy: { createdAt: 'asc' } },
      },
    });

    console.log('Task created successfully:', task.id);
    return res.status(201).json(serializeTask(task));
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
    updateData.archivedAt = parsed.data.completed ? new Date() : null;
  }
  if (parsed.data.deadline !== undefined) {
    updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  }
  if (parsed.data.reminderTime !== undefined) {
    updateData.reminderTime = parsed.data.reminderTime ? new Date(parsed.data.reminderTime) : null;
    updateData.reminderSent = false; // Reset reminder sent flag when time changes
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      subtasks: { orderBy: { createdAt: 'asc' } },
    },
  });

  return res.json(serializeTask(task));
});

router.post('/:id/subtasks', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const taskId = BigInt(req.params.id);
  const parsed = CreateSubtaskSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const subtask = await prisma.taskSubtask.create({
    data: { taskId, title: parsed.data.title },
  });

  return res.status(201).json({
    id: Number(subtask.id),
    title: subtask.title,
    completed: subtask.completed,
    createdAt: subtask.createdAt,
    updatedAt: subtask.updatedAt,
  });
});

router.put('/:id/subtasks/:subtaskId', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const taskId = BigInt(req.params.id);
  const subtaskId = BigInt(req.params.subtaskId);
  const parsed = UpdateSubtaskSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const subtask = await prisma.taskSubtask.findFirst({
    where: { id: subtaskId, taskId },
  });
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  const updated = await prisma.taskSubtask.update({
    where: { id: subtaskId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.completed !== undefined && { completed: parsed.data.completed }),
    },
  });

  return res.json({
    id: Number(updated.id),
    title: updated.title,
    completed: updated.completed,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

router.delete('/:id/subtasks/:subtaskId', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const taskId = BigInt(req.params.id);
  const subtaskId = BigInt(req.params.subtaskId);

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const subtask = await prisma.taskSubtask.findFirst({
    where: { id: subtaskId, taskId },
  });
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  await prisma.taskSubtask.delete({ where: { id: subtaskId } });
  return res.json({ success: true });
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
