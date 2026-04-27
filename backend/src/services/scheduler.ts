import { closeExpiredVotingSessions, checkExpiredDeadlines } from './voting-close';
import { checkAllPairsForInactivity } from './inactivity';

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  console.log('[Scheduler] Starting...');

  // Закрытие голосований — каждый час
  setInterval(async () => {
    try {
      const { closed, restarted } = await closeExpiredVotingSessions();
      if (closed > 0 || restarted > 0) {
        console.log(`[Scheduler] Voting: closed=${closed}, restarted=${restarted}`);
      }
    } catch (err) {
      console.error('[Scheduler] close_voting error:', err);
    }
  }, 60 * 60 * 1000);

  // Проверка неактивности пар — каждые 6 часов
  setInterval(async () => {
    try {
      const { checked, frozen } = await checkAllPairsForInactivity();
      if (frozen > 0) {
        console.log(`[Scheduler] Inactivity: checked=${checked}, frozen=${frozen}`);
      }
    } catch (err) {
      console.error('[Scheduler] inactivity error:', err);
    }
  }, 6 * 60 * 60 * 1000);

  // Проверка просроченных дедлайнов — раз в сутки
  setInterval(async () => {
    try {
      const { failed } = await checkExpiredDeadlines();
      if (failed > 0) {
        console.log(`[Scheduler] Deadlines: ${failed} goals failed`);
      }
    } catch (err) {
      console.error('[Scheduler] deadlines error:', err);
    }
  }, 24 * 60 * 60 * 1000);

  // Запуск при старте сервера
  closeExpiredVotingSessions().catch(err =>
    console.error('[Scheduler] Initial close_voting error:', err)
  );
  checkExpiredDeadlines().catch(err =>
    console.error('[Scheduler] Initial deadlines error:', err)
  );
}
