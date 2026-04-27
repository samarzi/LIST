import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Star, Zap, Shield, ChevronRight } from 'lucide-react';
import type { User } from '../api/client';

interface Props {
  user: User;
  onEdit?: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Новичок', 2: 'Новичок', 3: 'Новичок',
  4: 'Средний', 5: 'Средний', 6: 'Средний',
  7: 'Опытный', 8: 'Опытный', 9: 'Опытный',
  10: 'Мастер',
};

export default function ProfileCard({ user, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const name = user.displayName ?? user.firstName ?? user.username ?? 'Пользователь';
  const initials = name.slice(0, 2).toUpperCase();
  const levelLabel = LEVEL_LABELS[user.level] ?? 'Новичок';
  const total = user.totalGoalsCompleted + user.totalGoalsFailed;
  const winRate = total > 0 ? Math.round((user.totalGoalsCompleted / total) * 100) : 0;

  return (
    <div className="card card-border-gradient px-4 py-4" style={{ margin: '0 16px' }}>
      {/* Top row */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="avatar-wrap" style={{ width: 56, height: 56 }}>
          <svg
            width="56" height="56"
            viewBox="0 0 56 56"
            style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
          >
            <circle cx="28" cy="28" r="26" stroke="var(--border)" strokeWidth="1.5" fill="none" />
            <motion.circle
              cx="28" cy="28" r="26"
              stroke="url(#lvl-grad)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - user.level / 10) }}
              transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="lvl-grad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#0A84FF" />
              </linearGradient>
            </defs>
          </svg>
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={name}
              className="avatar"
              style={{ width: 48, height: 48, position: 'relative', zIndex: 1 }}
            />
          ) : (
            <div
              className="avatar-placeholder"
              style={{ width: 48, height: 48, fontSize: 18, position: 'relative', zIndex: 1 }}
            >
              {initials}
            </div>
          )}
          {/* Level badge */}
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1 0%, #0A84FF 100%)',
              border: '2px solid var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: '#fff',
              zIndex: 2,
            }}
          >
            {user.level}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <span className="title-sm truncate">{name}</span>
            {user.isArbitrator && (
              <span title="Арбитр">
                <Shield size={13} color="#818cf8" />
              </span>
            )}
            {user.isTeacher && (
              <span className="badge badge-accent" style={{ padding: '1px 5px', fontSize: 9 }}>
                Учитель
              </span>
            )}
          </div>
          {user.username && (
            <div className="body-sm text-faint mt-1">@{user.username}</div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Star size={12} color="#FFD60A" fill="#FFD60A" />
              <span className="caption" style={{ color: 'var(--text-2)' }}>{user.rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap size={12} color="#818cf8" />
              <span className="caption" style={{ color: 'var(--text-2)' }}>{user.litBalance} LIT</span>
            </div>
            <span className="badge badge-ghost" style={{ padding: '1px 6px', fontSize: 10 }}>
              {levelLabel}
            </span>
          </div>
        </div>

        {/* Settings */}
        {onEdit && (
          <button className="btn-icon btn-ghost" onClick={onEdit} style={{ flexShrink: 0 }}>
            <Settings size={18} color="var(--text-2)" />
          </button>
        )}
      </div>

      {/* Stats row */}
      <div
        className="flex gap-2 mt-3"
        style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
      >
        <StatPill label="Выполнено" value={user.totalGoalsCompleted} color="var(--green)" />
        <StatPill label="Провалено" value={user.totalGoalsFailed} color="var(--red)" />
        <StatPill label="Win rate" value={`${winRate}%`} color="var(--accent)" />
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          marginTop: 8,
          width: '100%',
          background: 'none',
          border: 'none',
          color: 'var(--text-3)',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '4px 0',
        }}
      >
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 8 }}>
              <LevelProgress level={user.level} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--surface-2)',
        borderRadius: 10,
        padding: '8px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

const LEVEL_XP: Record<number, string> = {
  1: 'Уровень 1', 2: 'Уровень 2', 3: 'Уровень 3',
  4: 'Уровень 4 — Можно стать Учителем',
  5: 'Уровень 5', 6: 'Уровень 6 — Можно стать Арбитром',
  7: 'Уровень 7', 8: 'Уровень 8', 9: 'Уровень 9',
  10: '🏆 Уровень 10 — Мастер',
};

function LevelProgress({ level }: { level: number }) {
  const pct = (level / 10) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-center">
        <span className="caption text-faint">Прогресс уровня</span>
        <span className="caption" style={{ color: 'var(--text-2)' }}>
          {LEVEL_XP[level] ?? `Уровень ${level}`}
        </span>
      </div>
      <div className="progress-track">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between">
        {[1,2,3,4,5,6,7,8,9,10].map(l => (
          <div
            key={l}
            style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: l <= level ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
