import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Zap, ArrowUpRight, ArrowDownLeft, Vote, Award, BookOpen, Target } from 'lucide-react';
import { litApi, type LitTransaction } from '../api/client';
import { useAuthStore } from '../store';

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

export default function LITPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<LitTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const balance = user?.litBalance ?? 0;
  const springBalance = useSpring(0, { stiffness: 80, damping: 20 });
  const displayBalance = useTransform(springBalance, v => Math.round(v));

  useEffect(() => {
    springBalance.set(balance);
  }, [balance, springBalance]);

  useEffect(() => {
    loadHistory(1);
  }, []);

  async function loadHistory(p: number) {
    try {
      const { data } = await litApi.history(p);
      if (p === 1) setTransactions(data.transactions);
      else setTransactions(prev => [...prev, ...data.transactions]);
      setHasMore(p < data.pages);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  // Split positive / negative
  const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="page-content">
      {/* Balance hero */}
      <div
        style={{
          margin: '20px 16px 0',
          padding: '28px 20px',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(10,132,255,0.2) 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Glow blob */}
        <div
          style={{
            position: 'absolute',
            top: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          БАЛАНС LIT
        </motion.div>

        <motion.div
          className="text-gradient"
          style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
        >
          <motion.span>{displayBalance}</motion.span>
        </motion.div>

        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>LIT токенов</div>

        {/* Stats row */}
        <div className="flex gap-3 mt-5" style={{ justifyContent: 'center' }}>
          <MiniStat label="Получено" value={`+${totalIn}`} color="var(--green)" />
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <MiniStat label="Потрачено" value={`-${totalOut}`} color="var(--red)" />
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <MiniStat label="Уровень" value={`${user?.level ?? 1}`} color="var(--accent)" />
        </div>
      </div>

      {/* History */}
      <div className="px-4 mt-6">
        <div className="label text-faint" style={{ marginBottom: 12 }}>История транзакций</div>

        {loading ? (
          <HistorySkeleton />
        ) : transactions.length === 0 ? (
          <EmptyHistory />
        ) : (
          <>
            {transactions.map((tx, i) => (
              <TxRow key={tx.id} tx={tx} index={i} />
            ))}
            {hasMore && (
              <button
                className="btn btn-ghost btn-full mt-3"
                onClick={() => loadHistory(page + 1)}
              >
                Загрузить ещё
              </button>
            )}
          </>
        )}
      </div>
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

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Zap size={28} color="var(--text-3)" /></div>
      <div>
        <h3 className="title-sm">Нет транзакций</h3>
        <p className="body-sm text-faint mt-1">Выполняй цели и голосуй, чтобы зарабатывать LIT</p>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex-col gap-3 flex">
      {[1, 2, 3, 4].map(i => (
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
  );
}
