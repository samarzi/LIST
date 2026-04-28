import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const CreateListingSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['teacher', 'student', 'team'] },
    title: { type: 'string', minLength: 3, maxLength: 200 },
    description: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'title'],
};

// Get all listings with optional type filter
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  
  const listings = await prisma.listing.findMany({
    where: {
      status: 'active',
      ...(type && { type }),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          photoUrl: true,
          level: true,
          rating: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json({
    listings: listings.map(l => ({
      id: Number(l.id),
      type: l.type,
      title: l.title,
      description: l.description,
      skills: l.skills,
      createdAt: l.createdAt.toISOString(),
      user: {
        id: Number(l.user.id),
        username: l.user.username,
        displayName: l.user.displayName,
        photoUrl: l.user.photoUrl,
        level: l.user.level,
        rating: Number(l.user.rating),
      },
    })),
  });
});

// Get my listings
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  const listings = await prisma.listing.findMany({
    where: {
      userId: BigInt(req.user!.userId),
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    listings: listings.map(l => ({
      id: Number(l.id),
      type: l.type,
      title: l.title,
      description: l.description,
      skills: l.skills,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

// Create listing
router.post('/', requireAuth, async (req: Request, res: Response) => {
  console.log('=== Creating listing ===');
  console.log('User ID:', req.user!.userId);
  console.log('Request body:', JSON.stringify(req.body));
  
  const { type, title, description, skills } = req.body;

  if (!type || !title) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Type and title are required' });
  }

  if (!['teacher', 'student', 'team'].includes(type)) {
    console.log('Invalid type:', type);
    return res.status(400).json({ error: 'Invalid type' });
  }

  console.log('Validation passed, creating listing...');
  
  try {
    const listing = await prisma.listing.create({
      data: {
        userId: BigInt(req.user!.userId),
        type,
        title,
        description,
        skills: skills || [],
      },
    });

    console.log('Listing created successfully:', listing.id);
    return res.status(201).json({
      id: Number(listing.id),
      type: listing.type,
      title: listing.title,
      description: listing.description,
      skills: listing.skills,
      status: listing.status,
      createdAt: listing.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    return res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Update listing
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = BigInt(req.params.id);
  const { title, description, skills, status } = req.body;

  const listing = await prisma.listing.findUnique({
    where: { id },
  });

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  if (listing.userId !== BigInt(req.user!.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(skills !== undefined && { skills }),
      ...(status !== undefined && { status }),
    },
  });

  return res.json({
    id: Number(updated.id),
    type: updated.type,
    title: updated.title,
    description: updated.description,
    skills: updated.skills,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
});

// Delete listing
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = BigInt(req.params.id);

  const listing = await prisma.listing.findUnique({
    where: { id },
  });

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  if (listing.userId !== BigInt(req.user!.userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await prisma.listing.delete({
    where: { id },
  });

  return res.json({ success: true });
});

export default router;
