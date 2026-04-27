import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Clock, Flame, TrendingUp } from 'lucide-react';
import type { Goal } from '../api/client';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:       { label: 'Черновик',    color: 'var(--text-3)',  bg: 'var(--surface-2)',              dot: 'rgba(255,255,255,0.2)' },
  on_review:   { label: 'На оценке',   color: 'var(--yellow)',  bg: 'rgba(255,214,10,0.1)',          dot: 'var(--yellow)' },
  in_progress: { label: 'В процессе',  color: 'var(--accent)',  bg: 'rgba(99,102,241,0.1)',          dot: 'var(--accent)' },
  on_check:    { label: 'На проверке', color: 'var(--orange)',  bg: 'rgba(255,159,10,0.1)',          dot: 'var(--orange)' },
  on_voting:   { label: 'Голосование', color: '#a78bfa',        bg: 'rgba(167,139,250,0.1)',         dot: '#a78bfa' },
  completed:   { label: 'Выполнено',   color: 'var(--green)',   bg: 'rgba(48,209,88,0.1)',           dot: 'var(--green)' },
  failed:      { label: 'Провалено',   color: 'var(--red)',     bg: 'rgba(255,69,58,0.1)',           dot: 'var(--red)' },
  rejected:    { label: 'Отклонено',   color: 'var(--text-3)',  bg: 'var(--surface-2)',              dot: 'rgba(255,255,255,0.2)' },
};

interface Props {
  goal: Goal;
  onClick?: () => void;
  index?: number;
}

export default function GoalCard({ goal, onClick, index = 0 }: Props) {
  const cfg = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.draft;
  const deadline = new Date(goal.deadline);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
      onClick={onClick}
      className="card card-glow"
      style={{ cursor: onClick ? 'pointer' : 'default', margin: '0 0 10px' }}
    >
      {/* Status bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 2,
          background: cfg.color,
          borderRadius: '14px 14px 0 0',
          opacity: 0.6,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 8 }}>
        <div
          className="flex items-center gap-2"
          style={{
            padding: '3px 8px',
            background: cfg.bg,
            borderRadius: 8,
            display: 'inline-flex',
          }}
        >
          <span
            style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: cfg.dot,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, letterSpacing: 0.3 }}>
            {cfg.label}
          </span>
        </div>

        {goal.difficulty !== null && goal.difficulty !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              background: 'var(--surface-2)',
              borderRadius: 8,
            }}
          >
            <Flame size={11} color="#FF9F0A" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>×{goal.difficulty}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 8, color: 'var(--text)' }}>
        {goal.title}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Deadline */}
          <div
            className="flex items-center gap-1"
            style={{ color: isOverdue ? 'var(--red)' : isUrgent ? 'var(--yellow)' : 'var(--text-3)' }}
          >
            {isUrgent || isOverdue ? (
              <Clock size={12} />
            ) : (
              <Calendar size={12} />
            )}
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {isOverdue
                ? `Просрочена ${Math.abs(daysLeft)}д`
                : daysLeft === 0
                ? 'Сегодня!'
                : `${daysLeft}д`}
            </span>
          </div>

          {/* Checkins */}
          {goal.checkinsCount > 0 && (
            <div className="flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <TrendingUp size={12} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{goal.checkinsCount}</span>
            </div>
          )}
        </div>

        {/* Stake */}
        {goal.stakeLit > 0 && (
          <div
            className="flex items-center gap-1"
            style={{
              padding: '2px 7px',
              background: 'rgba(99,102,241,0.1)',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#818cf8' }}>
              ⚡ {goal.stakeLit} LIT
            </span>
          </div>
        )}

        {/* Completed check */}
        {goal.status === 'completed' && (
          <CheckCircle2 size={16} color="var(--green)" />
        )}
      </div>
    </motion.div>
  );
}
