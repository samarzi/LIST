import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const CreateMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  type: z.enum(['question', 'improvement', 'feedback']).default('question'),
});

// Get messages for current pair
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  // Find current pair where user is partner
  const pair = await prisma.pair.findFirst({
    where: {
      partnerId: userId,
      status: 'active',
    },
  });

  if (!pair) {
    return res.json([]);
  }

  const messages = await prisma.pairMessage.findMany({
    where: { pairId: pair.id },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(messages.map(m => ({
    id: Number(m.id),
    content: m.content,
    type: m.type,
    createdAt: m.createdAt,
    sender: {
      id: Number(m.sender.id),
      username: m.sender.username,
      displayName: m.sender.displayName,
    },
    isFromMe: m.senderId === userId,
  })));
});

// Create a new message
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const parsed = CreateMessageSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Find current pair where user is partner
  const pair = await prisma.pair.findFirst({
    where: {
      partnerId: userId,
      status: 'active',
    },
  });

  if (!pair) {
    return res.status(404).json({ error: 'No active pair found' });
  }

  const message = await prisma.pairMessage.create({
    data: {
      pairId: pair.id,
      senderId: userId,
      content: parsed.data.content,
      type: parsed.data.type,
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // Send notification to watcher via Telegram bot
  // TODO: Implement Telegram notification

  return res.status(201).json({
    id: Number(message.id),
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    sender: {
      id: Number(message.sender.id),
      username: message.sender.username,
      displayName: message.sender.displayName,
    },
    isFromMe: true,
  });
});

export default router;
