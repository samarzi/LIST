import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, CheckCircle2, RefreshCw, Clock, Star, User, ExternalLink } from 'lucide-react';
import { votingApi, type VotingSession } from '../api/client';

const SCORE_ANCHORS_GOAL = [
  { score: 0, label: 'Цель невалидна / доказательства не соответствуют' },
  { score: 3, label: 'Слабая цель, доказательства скромные' },
  { score: 5, label: 'Нормальная цель, выполнена удовлетворительно' },
  { score: 7, label: 'Хорошая цель, хорошо доказана' },
  { score: 10, label: 'Отличная амбициозная цель, блестящее доказательство' },
];

const SCORE_ANCHORS_WATCHER = [
  { score: 0, label: 'Плохая поддержка / подтвердил явный фейк' },
  { score: 3, label: 'Слабая поддержка, формальное подтверждение' },
  { score: 5, label: 'Нормальная поддержка' },
  { score: 7, label: 'Хорошая поддержка и честная оценка' },
  { score: 10, label: 'Отличная поддержка, идеальная работа смотрящего' },
];

function getAnchorLabel(score: number, anchors: typeof SCORE_ANCHORS_GOAL): string {
  let best = anchors[0];
  for (const a of anchors) {
    if (Math.abs(a.score - score) < Math.abs(best.score - score)) best = a;
  }
  return best.label;
}

export default function VotingPage() {
  const [session, setSession] = useState<VotingSession | null | undefined>(undefined);
  const [scoreGoal, setScoreGoal] = useState(5);
  const [scoreWatcher, setScoreWatcher] = useState(5);
  const [goalTouched, setGoalTouched] = useState(false);
  const [watcherTouched, setWatcherTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNext();
  }, []);

  async function loadNext() {
    setSession(undefined);
    setScoreGoal(5);
    setScoreWatcher(5);
    setGoalTouched(false);
    setWatcherTouched(false);
    setSubmitted(false);
    try {
      const { data } = await votingApi.next();
      setSession(data.session);
    } catch {
      setSession(null);
    }
  }

  async function handleSubmit() {
    if (!session || !goalTouched || !watcherTouched) return;
    setLoading(true);
    try {
      await votingApi.vote(session.id, scoreGoal, scoreWatcher);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (session === undefined) return <VotingLoader />;

  return (
    <div className="page-content">
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 12 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 4 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Vote size={18} color="#a78bfa" />
          </div>
          <div>
            <h1 className="title-lg">Голосование</h1>
            <p className="body-sm text-faint mt-1">Оцени чужую цель и заработай LIT</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <SuccessView key="success" onNext={loadNext} />
        ) : session === null ? (
          <EmptyView key="empty" onRefresh={loadNext} />
        ) : (
          <VotingForm
            key={session.id}
            session={session}
            scoreGoal={scoreGoal}
            scoreWatcher={scoreWatcher}
            goalTouched={goalTouched}
            watcherTouched={watcherTouched}
            loading={loading}
            onScoreGoal={v => { setScoreGoal(v); setGoalTouched(true); }}
            onScoreWatcher={v => { setScoreWatcher(v); setWatcherTouched(true); }}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VotingForm({
  session, scoreGoal, scoreWatcher, goalTouched, watcherTouched,
  loading, onScoreGoal, onScoreWatcher, onSubmit,
}: {
  session: VotingSession;
  scoreGoal: number;
  scoreWatcher: number;
  goalTouched: boolean;
  watcherTouched: boolean;
  loading: boolean;
  onScoreGoal: (v: number) => void;
  onScoreWatcher: (v: number) => void;
  onSubmit: () => void;
}) {
  const deadline = new Date(session.deadline);
  const hoursLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));
  const difficulty = session.goal.difficulty ?? 0;
  const diffLabel = difficulty <= 3 ? 'Простая' : difficulty <= 6 ? 'Средняя' : difficulty <= 9 ? 'Сложная' : 'Эпик';

  const canSubmit = goalTouched && watcherTouched && !loading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="px-4"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Meta */}
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <div className="flex items-center gap-2">
          <span className="badge badge-ghost">
            <User size={10} />
            {session.goal.user.displayName ?? session.goal.user.username ?? 'Участник'}
          </span>
          <span className="badge" style={{ background: 'rgba(255,159,10,0.12)', color: 'var(--orange)', border: '1px solid rgba(255,159,10,0.25)' }}>
            🔥 {diffLabel} ({difficulty}/10)
          </span>
        </div>
        <div className="flex items-center gap-1" style={{ color: 'var(--text-3)', fontSize: 12 }}>
          <Clock size={12} />
          <span>{hoursLeft}ч</span>
        </div>
      </div>

      {/* Progress */}
      <div className="card" style={{ padding: '10px 14px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span className="caption text-faint">Проголосовало</span>
          <span className="caption" style={{ color: 'var(--text-2)' }}>
            {session.votesCount} / {session.requiredVotes}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (session.votesCount / session.requiredVotes) * 100)}%` }}
          />
        </div>
      </div>

      {/* Goal */}
      <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="label text-faint" style={{ marginBottom: 8 }}>Цель</div>
        <h3 className="title-sm" style={{ marginBottom: 8 }}>{session.goal.title}</h3>
        <div className="body-sm" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>
          {session.goal.successCriteria}
        </div>
      </div>

      {/* Proof */}
      {session.goal.proof && (
        <div className="card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div className="label text-faint" style={{ marginBottom: 8 }}>Доказательство</div>
          <p className="body-sm" style={{ color: 'var(--text-2)', lineHeight: 1.5, marginBottom: session.goal.proof.mediaUrls.length > 0 ? 10 : 0 }}>
            {session.goal.proof.description}
          </p>
          {session.goal.proof.mediaUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
              style={{
                padding: '8px 10px',
                background: 'var(--surface-2)',
                borderRadius: 8,
                color: '#818cf8',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                marginTop: 6,
              }}
            >
              <ExternalLink size={13} />
              Ссылка {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* Slider 1: Goal score */}
      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
          <div className="label text-faint">Оценка цели и результата</div>
          <ScoreBadge score={scoreGoal} touched={goalTouched} />
        </div>
        <SliderWithTrack
          value={scoreGoal}
          onChange={onScoreGoal}
          touched={goalTouched}
        />
        <div
          className="body-sm"
          style={{ color: 'var(--text-3)', marginTop: 8, fontSize: 12, minHeight: 32 }}
        >
          {goalTouched ? getAnchorLabel(scoreGoal, SCORE_ANCHORS_GOAL) : 'Подвигай ползунок для оценки'}
        </div>
      </div>

      {/* Slider 2: Watcher score */}
      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
          <div className="label text-faint">Оценка работы смотрящего</div>
          <ScoreBadge score={scoreWatcher} touched={watcherTouched} />
        </div>
        <SliderWithTrack
          value={scoreWatcher}
          onChange={onScoreWatcher}
          touched={watcherTouched}
          color="#a78bfa"
        />
        <div
          className="body-sm"
          style={{ color: 'var(--text-3)', marginTop: 8, fontSize: 12, minHeight: 32 }}
        >
          {watcherTouched ? getAnchorLabel(scoreWatcher, SCORE_ANCHORS_WATCHER) : 'Подвигай ползунок для оценки'}
        </div>
      </div>

      {/* Hint */}
      {(!goalTouched || !watcherTouched) && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255,214,10,0.08)',
            border: '1px solid rgba(255,214,10,0.2)',
            borderRadius: 12,
            fontSize: 12,
            color: 'var(--yellow)',
          }}
        >
          ⚡ Подвигай оба ползунка перед отправкой. За честное голосование (±1 от медианы) получишь +2 LIT
        </div>
      )}

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        className="btn btn-primary btn-full"
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{ marginTop: 4, marginBottom: 24 }}
      >
        {loading ? 'Отправляю...' : (
          <span className="flex items-center gap-2">
            <Vote size={18} />
            Отправить оценку
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

function SliderWithTrack({
  value,
  onChange,
  touched,
  color = 'var(--accent)',
}: {
  value: number;
  onChange: (v: number) => void;
  touched: boolean;
  color?: string;
}) {
  const pct = (value / 10) * 100;
  return (
    <div style={{ position: 'relative', paddingTop: 4 }}>
      {/* Track fill */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: `${pct}%`,
          height: 6,
          background: touched ? color : 'var(--surface-3)',
          borderRadius: 3,
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          transition: 'background 0.2s',
          zIndex: 1,
        }}
      />
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'transparent',
        }}
      />
      {/* Markers */}
      <div className="flex justify-between" style={{ marginTop: 4 }}>
        {[0, 2, 4, 6, 8, 10].map(v => (
          <span key={v} style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1 }}>{v}</span>
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({ score, touched }: { score: number; touched: boolean }) {
  const color = !touched ? 'var(--text-3)' :
    score <= 2 ? 'var(--red)' :
    score <= 4 ? 'var(--orange)' :
    score <= 6 ? 'var(--yellow)' :
    score <= 8 ? 'var(--accent)' : 'var(--green)';

  return (
    <motion.div
      key={score}
      initial={{ scale: 0.8, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        fontSize: 22,
        fontWeight: 800,
        color,
        minWidth: 32,
        textAlign: 'right',
        lineHeight: 1,
        transition: 'color 0.2s',
      }}
    >
      {touched ? score : '—'}
    </motion.div>
  );
}

function SuccessView({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="empty-state"
      style={{ paddingTop: 60 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'rgba(48,209,88,0.15)',
          border: '1px solid rgba(48,209,88,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <CheckCircle2 size={40} color="var(--green)" />
      </motion.div>
      <div style={{ textAlign: 'center' }}>
        <h2 className="title-md" style={{ marginBottom: 8 }}>Голос принят!</h2>
        <p className="body-sm text-faint">
          Если твоя оценка попала в ±1 от медианы — получишь +2 LIT
        </p>
      </div>
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn btn-primary"
          onClick={onNext}
          style={{ gap: 8 }}
        >
          <RefreshCw size={16} />
          Следующее
        </motion.button>
      </div>
    </motion.div>
  );
}

function EmptyView({ onRefresh }: { onRefresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="empty-state"
      style={{ paddingTop: 60 }}
    >
      <div className="empty-icon" style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
        <Star size={28} color="#a78bfa" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 className="title-sm" style={{ marginBottom: 6 }}>Нечего голосовать</h3>
        <p className="body-sm text-faint">Активных голосований пока нет. Загляни позже.</p>
      </div>
      <button className="btn btn-ghost" onClick={onRefresh} style={{ gap: 8 }}>
        <RefreshCw size={16} />
        Обновить
      </button>
    </motion.div>
  );
}

function VotingLoader() {
  return (
    <div className="px-4" style={{ paddingTop: 16 }}>
      <div className="skeleton" style={{ height: 80, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 140, borderRadius: 14 }} />
    </div>
  );
}
