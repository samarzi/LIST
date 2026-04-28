import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Settings, Star, Zap, Shield, ChevronRight, History, Target, Award, Vote, ArrowUpRight, ArrowDownLeft, BookOpen, X, Users, Activity, Globe, Circle } from 'lucide-react';
import type { User } from '../api/client';
import { litApi, usersApi, type LitTransaction } from '../api/client';

interface Props {
  user: User;
  onEdit?: () => void;
}

const TX_ICONS: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  goal_reward:         { icon: Target,      color: 'var(--green)',  bg: 'rgba(48,209,88,0.12)' },
  watch_reward:        { icon: Award,       color: '#818cf8',       bg: 'rgba(99,102,241,0.12)' },
  vote_bonus:          { icon: Vote,        color: 'var(--accent)', bg: 'rgba(99,102,241,0.12)' },
  stake_win:           { icon: ArrowUpRight, color: 'var(--green)', bg: 'rgba(48,209,88,0.12)' },
  stake_loss:          { icon: ArrowDownLeft, color: 'var(--red)',  bg: 'rgba(255,69,58,0.12)' },
  teacher_payment:     { icon: BookOpen,    color: 'var(--yellow)', bg: 'rgba(255,214,10,0.12)' },
  arbitration_reward:  { icon: Award,       color: '#a78bfa',      bg: 'rgba(167,139,250,0.12)' },
  default:             { icon: Zap,         color: 'var(--text-2)', bg: 'var(--surface-2)' },
};

const TX_LABELS: Record<string, string> = {
  goal_reward: 'Цель выполнена',
  watch_reward: 'Награда смотрящего',
  vote_bonus: 'Бонус за голосование',
  stake_win: 'Выигрыш ставки',
  stake_loss: 'Проигрыш ставки',
  teacher_payment: 'Оплата учителю',
  arbitration_reward: 'Награда арбитра',
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Новичок', 2: 'Новичок', 3: 'Новичок',
  4: 'Средний', 5: 'Средний', 6: 'Средний',
  7: 'Опытный', 8: 'Опытный', 9: 'Опытный',
  10: 'Мастер',
};

function AnalyticsStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <Icon size={16} color="var(--accent)" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function isOnline(lastSeenAt: string): boolean {
  const lastSeen = new Date(lastSeenAt);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastSeen > fiveMinutesAgo;
}

export default function ProfileCard({ user, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [transactions, setTransactions] = useState<LitTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [analytics, setAnalytics] = useState<{ totalUsers: number; onlineUsers: number; dailyActiveUsers: number } | null>(null);
  const name = user.displayName ?? user.firstName ?? user.username ?? 'Пользователь';
  const initials = name.slice(0, 2).toUpperCase();
  const levelLabel = LEVEL_LABELS[user.level] ?? 'Новичок';
  const total = user.totalGoalsCompleted + user.totalGoalsFailed;
  const winRate = total > 0 ? Math.round((user.totalGoalsCompleted / total) * 100) : 0;

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const { data } = await usersApi.analytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }

  async function loadHistory() {
    if (transactions.length > 0) {
      setShowHistory(true);
      return;
    }
    setLoadingHistory(true);
    try {
      const { data } = await litApi.history(1);
      setTransactions(data.transactions);
      setShowHistory(true);
    } finally {
      setLoadingHistory(false);
    }
  }

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
            {/* Online status */}
            {user.lastSeenAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Circle 
                  size={8} 
                  fill={isOnline(user.lastSeenAt) ? 'var(--green)' : 'var(--text-3)'}
                  color={isOnline(user.lastSeenAt) ? 'var(--green)' : 'var(--text-3)'}
                />
                <span className="caption" style={{ color: 'var(--text-3)', fontSize: 9 }}>
                  {isOnline(user.lastSeenAt) ? 'Онлайн' : 'Оффлайн'}
                </span>
              </div>
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

      {/* LIT row */}
      <div
        className="flex items-center gap-3 mt-3"
        style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
      >
        <div
          style={{
            flex: 1,
            background: 'rgba(99,102,241,0.1)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Zap size={16} color="#818cf8" />
          <div>
            <div className="caption text-faint">Баланс LIT</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#818cf8' }}>{user.litBalance}</div>
          </div>
        </div>
        <button
          onClick={loadHistory}
          className="btn btn-ghost"
          style={{ padding: '8px 12px', fontSize: 12 }}
        >
          <History size={14} />
          История
        </button>
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
              
              {/* Analytics */}
              {analytics && (
                <div style={{ marginTop: 16, padding: '12px', background: 'var(--surface-2)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} />
                    Аналитика сообщества
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <AnalyticsStat icon={Users} label="Всего" value={analytics.totalUsers} />
                    <AnalyticsStat icon={Globe} label="Онлайн" value={analytics.onlineUsers} />
                    <AnalyticsStat icon={Activity} label="За день" value={analytics.dailyActiveUsers} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History modal - Portal to render outside component */}
      {showHistory && createPortal(
        <AnimatePresence>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowHistory(false); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              style={{ maxHeight: '80vh' }}
            >
              <div className="modal-handle" />
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h2 className="title-sm">История LIT</h2>
                <button className="btn-icon btn-ghost" onClick={() => setShowHistory(false)}>
                  <X size={18} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex-col gap-3 flex">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 6 }} />
                        <div className="skeleton" style={{ height: 11, width: '40%' }} />
                      </div>
                      <div className="skeleton" style={{ width: 60, height: 16 }} />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Zap size={28} color="var(--text-3)" /></div>
                  <div>
                    <h3 className="title-sm">Нет транзакций</h3>
                    <p className="body-sm text-faint mt-1">Выполняй цели и голосуй, чтобы зарабатывать LIT</p>
                  </div>
                </div>
              ) : (
                <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                  {transactions.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
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

function TxRow({ tx, index }: { tx: LitTransaction; index: number }) {
  const cfg = TX_ICONS[tx.type] ?? TX_ICONS.default;
  const Icon = cfg.icon;
  const label = TX_LABELS[tx.type] ?? tx.note ?? tx.type;
  const date = new Date(tx.createdAt);
  const isPositive = tx.amount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 40, height: 40,
          borderRadius: 12,
          background: cfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={cfg.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="body-sm truncate" style={{ fontWeight: 500 }}>{label}</div>
        <div className="caption text-faint mt-1">
          {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: isPositive ? 'var(--green)' : 'var(--red)',
          flexShrink: 0,
        }}
      >
        {isPositive ? '+' : ''}{tx.amount} LIT
      </div>
    </motion.div>
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
