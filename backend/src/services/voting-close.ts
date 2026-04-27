import prisma from '../lib/prisma';

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getDifficultyMultiplier(difficulty: number): number {
  if (difficulty <= 3) return 1;
  if (difficulty <= 6) return 3;
  if (difficulty <= 9) return 8;
  return 20;
}

export async function closeExpiredVotingSessions(): Promise<{ closed: number; restarted: number }> {
  const expiredSessions = await prisma.votingSession.findMany({
    where: {
      status: 'open',
      deadline: { lte: new Date() },
    },
    include: {
      goal: {
        include: {
          user: true,
          pair: true,
        },
      },
    },
  });

  let closed = 0;
  let restarted = 0;

  for (const session of expiredSessions) {
    const votes = await prisma.vote.findMany({
      where: { goalId: session.goalId },
    });

    if (votes.length === 0) {
      // Нет голосов — перезапускаем на 3 дня
      await prisma.votingSession.update({
        where: { id: session.id },
        data: { deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      });
      restarted++;
      continue;
    }

    const goalScores = votes.map(v => v.scoreGoal);
    const watcherScores = votes.map(v => v.scoreWatcher);
    const medianGoal = calculateMedian(goalScores);
    const medianWatcher = calculateMedian(watcherScores);

    const difficulty = session.goal.difficulty ?? 5;
    const multiplier = getDifficultyMultiplier(difficulty);
    const studentLit = Math.round(medianGoal * multiplier * 0.6);
    const watcherLit = Math.round(medianWatcher * multiplier * 0.3);
    const isCompleted = medianGoal >= 5;

    await prisma.$transaction(async tx => {
      await tx.votingSession.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          medianGoal,
          medianWatcher,
          closedAt: new Date(),
        },
      });

      await tx.goal.update({
        where: { id: session.goalId },
        data: {
          status: isCompleted ? 'completed' : 'failed',
          completedAt: new Date(),
        },
      });

      if (isCompleted) {
        await tx.user.update({
          where: { id: session.goal.userId },
          data: {
            litBalance: { increment: studentLit },
            totalGoalsCompleted: { increment: 1 },
            rating: { increment: 0.1 },
          },
        });
        await tx.litTransaction.create({
          data: {
            userId: session.goal.userId,
            amount: studentLit,
            type: 'goal_reward',
            relatedId: session.goalId,
            note: `Цель выполнена. Оценка ${medianGoal.toFixed(1)}, сложность ${difficulty}`,
          },
        });

        if (session.goal.pair) {
          await tx.user.update({
            where: { id: session.goal.pair.watcherId },
            data: {
              litBalance: { increment: watcherLit },
              rating: { increment: 0.05 },
            },
          });
          await tx.litTransaction.create({
            data: {
              userId: session.goal.pair.watcherId,
              amount: watcherLit,
              type: 'watch_reward',
              relatedId: session.goalId,
              note: `Награда смотрящего. Оценка ${medianWatcher.toFixed(1)}`,
            },
          });
        }
      } else {
        await tx.user.update({
          where: { id: session.goal.userId },
          data: {
            totalGoalsFailed: { increment: 1 },
            rating: { decrement: 0.1 },
          },
        });

        // 30% ставки уходит смотрящему при провале
        const stake = session.goal.stakeLit;
        if (stake > 0 && session.goal.pair) {
          const watcherShare = Math.round(stake * 0.3);
          await tx.user.update({
            where: { id: session.goal.pair.watcherId },
            data: { litBalance: { increment: watcherShare } },
          });
          await tx.litTransaction.create({
            data: {
              userId: session.goal.pair.watcherId,
              amount: watcherShare,
              type: 'stake_win',
              relatedId: session.goalId,
              note: `Доля ставки от проваленной цели ученика`,
            },
          });
        }
      }

      // Бонус честным судьям (±1 от медианы по обоим ползункам)
      for (const vote of votes) {
        const withinGoal = Math.abs(vote.scoreGoal - medianGoal) <= 1;
        const withinWatcher = Math.abs(vote.scoreWatcher - medianWatcher) <= 1;
        if (withinGoal && withinWatcher) {
          await tx.user.update({
            where: { id: vote.voterId },
            data: { litBalance: { increment: 2 } },
          });
          await tx.litTransaction.create({
            data: {
              userId: vote.voterId,
              amount: 2,
              type: 'vote_bonus',
              relatedId: session.goalId,
              note: `Бонус за честное голосование (±1 от медианы)`,
            },
          });
        }
      }
    });

    closed++;
  }

  return { closed, restarted };
}

export async function checkExpiredDeadlines(): Promise<{ failed: number }> {
  const expiredGoals = await prisma.goal.findMany({
    where: {
      deadline: { lt: new Date() },
      status: 'in_progress',
    },
  });

  for (const goal of expiredGoals) {
    await prisma.$transaction([
      prisma.goal.update({
        where: { id: goal.id },
        data: { status: 'failed', completedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: goal.userId },
        data: {
          totalGoalsFailed: { increment: 1 },
          rating: { decrement: 0.1 },
        },
      }),
    ]);
  }

  return { failed: expiredGoals.length };
}
