import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import { enqueueNotification } from '../services/queue';

const router = Router();

const CreateMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  type: z.enum(['question', 'improvement', 'feedback', 'text']).default('text'),
});

async function findActivePair(userId: bigint) {
  return prisma.pair.findFirst({
    where: {
      status: 'active',
      OR: [{ partnerId: userId }, { watcherId: userId }],
    },
  });
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);

  const pair = await findActivePair(userId);
  if (!pair) return res.json([]);

  const messages = await prisma.pairMessage.findMany({
    where: { pairId: pair.id },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
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

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const parsed = CreateMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const pair = await findActivePair(userId);
  if (!pair) return res.status(404).json({ error: 'No active pair found' });

  const message = await prisma.pairMessage.create({
    data: {
      pairId: pair.id,
      senderId: userId,
      content: parsed.data.content,
      type: parsed.data.type,
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
    },
  });

  // Notify the other person in the pair
  const recipientId = pair.partnerId === userId ? pair.watcherId : pair.partnerId;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { telegramId: true, displayName: true, firstName: true },
  });
  if (recipient) {
    const senderName = message.sender.displayName ?? message.sender.username ?? 'Партнёр';
    await enqueueNotification(
      recipient.telegramId,
      `💬 *${senderName}:* ${parsed.data.content}`,
    );
  }

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
