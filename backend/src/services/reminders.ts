import prisma from '../lib/prisma';
import { Telegraf } from 'telegraf';

let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf) {
  botInstance = bot;
}

/**
 * Проверяет и отправляет напоминания для задач и привычек
 * Должна запускаться по расписанию (например, каждую минуту)
 */
export async function checkAndSendReminders() {
  console.log('Checking for reminders...');
  
  const now = new Date();
  
  // Находим задачи с напоминаниями, которые еще не отправлены и время пришло
  const tasks = await prisma.task.findMany({
    where: {
      reminderTime: { lte: now },
      reminderSent: false,
      completed: false,
    },
    include: {
      user: {
        select: {
          telegramId: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // Находим привычки с напоминаниями, которые еще не отправлены и время пришло
  const habits = await prisma.habit.findMany({
    where: {
      reminderTime: { lte: now },
      reminderSent: false,
    },
    include: {
      user: {
        select: {
          telegramId: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  console.log(`Found ${tasks.length} tasks and ${habits.length} habits with pending reminders`);

  // Отправляем напоминания для задач
  for (const task of tasks) {
    if (botInstance) {
      try {
        await botInstance.telegram.sendMessage(
          Number(task.user.telegramId),
          `⏰ *Напоминание о задаче*\n\n` +
          `Задача: ${task.title}\n` +
          `${task.description ? `Описание: ${task.description}\n` : ''}` +
          `Не забудь выполнить!`,
          { parse_mode: 'Markdown' }
        );
        
        // Помечаем как отправленное
        await prisma.task.update({
          where: { id: task.id },
          data: { reminderSent: true },
        });
        
        console.log(`Reminder sent for task ${task.id}`);
      } catch (error) {
        console.error(`Failed to send reminder for task ${task.id}:`, error);
      }
    }
  }

  // Отправляем напоминания для привычек
  for (const habit of habits) {
    if (botInstance) {
      try {
        await botInstance.telegram.sendMessage(
          Number(habit.user.telegramId),
          `⏰ *Напоминание о привычке*\n\n` +
          `Привычка: ${habit.title}\n` +
          `${habit.description ? `Описание: ${habit.description}\n` : ''}` +
          `Не забудь выполнить сегодня!`,
          { parse_mode: 'Markdown' }
        );
        
        // Помечаем как отправленное
        await prisma.habit.update({
          where: { id: habit.id },
          data: { reminderSent: true },
        });
        
        console.log(`Reminder sent for habit ${habit.id}`);
      } catch (error) {
        console.error(`Failed to send reminder for habit ${habit.id}:`, error);
      }
    }
  }

  return { tasksSent: tasks.length, habitsSent: habits.length };
}
