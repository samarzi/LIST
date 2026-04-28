import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, CheckCircle2, ExternalLink, ChevronRight, Star } from 'lucide-react';
import { votingApi, type VotingSession } from '../api/client';

const GOAL_LABELS: [number, string][] = [
  [0, 'Невалид'],
  [3, 'Легко'],
  [5, 'Средне'],
  [7, 'Сложно'],
  [10, 'Легенда'],
];

const WATCHER_LABELS: [number, string][] = [
  [0, 'Не следил'],
  [3, 'Слабо'],
  [5, 'Нормально'],
  [7, 'Хорошо'],
  [10, 'Отлично'],
];

function scoreColor(v: number): string {
  if (v <= 2) return 'var(--red)';
  if (v <= 4) return 'var(--orange)';
  if (v <= 6) return 'var(--yellow)';
  if (v <= 8) return 'var(--green)';
  return '#a78bfa';
}

function labelFor(v: number, anchors: [number, string][]): string {
  let label = anchors[0][1];
  for (const [threshold, text] of anchors) {
    if (v >= threshold) label = text;
  }
  return label;
}

export default function VotingPage() {
  const [session, setSession] = useState<VotingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setSubmitted(false);
    try {
      const { data } = await votingApi.next();
      setSession(data.session);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoted() {
    setSubmitted(true);
  }

  if (loading) return <VotingSkeleton />;

  return (
    <div className="page-content">
      <div style={{ padding: '24px 16px 0' }}>
        <h1 className="title-lg">Голосование</h1>
        <p className="body-sm text-faint mt-2">
          Оцени результат объективно — это влияет на LIT и рейтинг
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <AnimatePresence mode="wait">
          {submitted ? (
            <SuccessView key="success" onNext={load} />
          ) : session ? (
            <VotingForm key={session.id} session={session} onVoted={handleVoted} />
          ) : (
            <EmptyView key="empty" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function VotingForm({ session, onVoted }: { session: VotingSession; onVoted: () => void }) {
  const [goalScore, setGoalScore] = useState(5);
  const [watcherScore, setWatcherScore] = useState(5);
  const [touchedGoal, setTouchedGoal] = useState(false);
  const [touchedWatcher, setTouchedWatcher] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = touchedGoal && touchedWatcher && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await votingApi.vote(session.id, goalScore, watcherScore);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onVoted();
    } finally {
      setSubmitting(false);
    }
  }

  const deadline = new Date(session.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      {/* Goal card */}
      <div
        className="card"
        style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.2)',
          marginBottom: 16,
        }}
      >
        {/* User */}
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#0A84FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#fff',
            }}
          >
            {(session.goal.user.displayName ?? session.goal.user.username ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="title-sm truncate">
              {session.goal.user.displayName ?? session.goal.user.username ?? 'Участник'}
            </div>
            <div className="body-sm text-faint">Уровень {session.goal.user.level}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="badge badge-purple">{session.votesCount}/{session.requiredVotes} голосов</div>
            {daysLeft > 0 && (
              <div className="caption text-faint mt-2" style={{ marginTop: 4 }}>ещё {daysLeft}д</div>
            )}
          </div>
        </div>

        {/* Goal title */}
        <div style={{ marginBottom: 10 }}>
          <div className="label text-faint mb-2">Цель</div>
          <p className="body-sm" style={{ color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>
            {session.goal.title}
          </p>
        </div>

        {/* Success criteria */}
        <div style={{ marginBottom: session.goal.proof ? 12 : 0 }}>
          <div className="label text-faint mb-2">Критерии успеха</div>
          <p className="body-sm text-muted" style={{ lineHeight: 1.5 }}>
            {session.goal.successCriteria}
          </p>
        </div>

        {/* Proof */}
        {session.goal.proof && (
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(48,209,88,0.06)',
              border: '1px solid rgba(48,209,88,0.15)',
              borderRadius: 10,
            }}
          >
            <div className="label text-faint mb-2">Доказательство</div>
            <p className="body-sm" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
              {session.goal.proof.description}
            </p>
            {session.goal.proof.mediaUrls?.length > 0 && (
              <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
                {session.goal.proof.mediaUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, color: 'var(--accent)', fontWeight: 500,
                    }}
                  >
                    <ExternalLink size={12} />
                    Ссылка {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Goal score slider */}
      <ScoreSlider
        label="Оценка цели"
        hint="Выполнена ли цель согласно критериям?"
        value={goalScore}
        touched={touchedGoal}
        anchors={GOAL_LABELS}
        onChange={v => { setGoalScore(v); setTouchedGoal(true); }}
      />

      {/* Watcher score slider */}
      <ScoreSlider
        label="Оценка смотрящего"
        hint="Насколько хорошо смотрящий выполнял свою роль?"
        value={watcherScore}
        touched={touchedWatcher}
        anchors={WATCHER_LABELS}
        onChange={v => { setWatcherScore(v); setTouchedWatcher(true); }}
        style={{ marginTop: 16 }}
      />

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        className="btn btn-primary btn-full"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{ marginTop: 20 }}
      >
        {submitting ? 'Отправляю...' : (
          <>
            {touchedGoal && touchedWatcher ? (
              <>Отправить голос <ChevronRight size={16} /></>
            ) : (
              'Подвигай оба слайдера'
            )}
          </>
        )}
      </motion.button>

      {(!touchedGoal || !touchedWatcher) && (
        <p className="caption text-faint text-center" style={{ marginTop: 8 }}>
          Нужно оценить и цель, и смотрящего
        </p>
      )}
    </motion.div>
  );
}

function ScoreSlider({
  label,
  hint,
  value,
  touched,
  anchors,
  onChange,
  style: outerStyle,
}: {
  label: string;
  hint: string;
  value: number;
  touched: boolean;
  anchors: [number, string][];
  onChange: (v: number) => void;
  style?: React.CSSProperties;
}) {
  const color = touched ? scoreColor(value) : 'var(--text-3)';
  const text = touched ? labelFor(value, anchors) : '—';
  const fillPct = (value / 10) * 100;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        ...outerStyle,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="title-sm">{label}</div>
          <div className="caption text-faint mt-1">{hint}</div>
        </div>
        <motion.div
          key={value + touched.toString()}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: 28,
            fontWeight: 800,
            color,
            minWidth: 40,
            textAlign: 'right',
          }}
        >
          {touched ? value : '?'}
        </motion.div>
      </div>

      {/* Custom track */}
      <div className="score-track" style={{ marginBottom: 8 }}>
        <div
          className="score-track-fill"
          style={{
            width: `${fillPct}%`,
            background: touched
              ? `linear-gradient(90deg, ${color}88, ${color})`
              : 'var(--surface-3)',
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ marginBottom: 8 }}
      />

      {/* Anchor labels */}
      <div className="flex justify-between">
        {anchors.map(([, text], i) => (
          <span
            key={i}
            style={{
              fontSize: 9.5,
              color: 'var(--text-3)',
              fontWeight: 500,
              textAlign: i === 0 ? 'left' : i === anchors.length - 1 ? 'right' : 'center',
            }}
          >
            {text}
          </span>
        ))}
      </div>

      {touched && value === 0 && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            background: 'rgba(255,69,58,0.08)',
            border: '1px solid rgba(255,69,58,0.2)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--red)',
          }}
        >
          ⚠ Оценка 0 означает что цель/роль полностью не выполнена
        </div>
      )}
    </div>
  );
}

function SuccessView({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="empty-state"
      style={{ paddingTop: 60 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(48,209,88,0.12)',
          border: '1px solid rgba(48,209,88,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <CheckCircle2 size={32} color="var(--green)" />
      </motion.div>
      <div>
        <h3 className="title-md text-center">Голос принят!</h3>
        <p className="body-sm text-faint text-center mt-2">
          +2 LIT если твоя оценка близка к медиане
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.96 }}
        className="btn btn-primary"
        onClick={onNext}
      >
        <Star size={16} />
        Следующая цель
      </motion.button>
    </motion.div>
  );
}

function EmptyView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="empty-state"
      style={{ paddingTop: 60 }}
    >
      <div className="empty-icon">
        <Vote size={28} color="var(--text-3)" />
      </div>
      <div>
        <h3 className="title-sm text-center">Нет целей для голосования</h3>
        <p className="body-sm text-faint text-center mt-2">
          Приходи позже — появятся новые цели на проверке
        </p>
      </div>
    </motion.div>
  );
}

function VotingSkeleton() {
  return (
    <div className="page-content">
      <div style={{ padding: '24px 16px 0' }}>
        <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
      <div style={{ padding: '16px' }}>
        <div className="skeleton" style={{ height: 180, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
      </div>
    </div>
  );
}
