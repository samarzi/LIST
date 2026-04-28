import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Clock, TrendingUp, AlertCircle, X, ChevronRight, Flame } from 'lucide-react';
import { pairsApi, goalsApi, type WatcherStudent, type PairStatus } from '../api/client';

const DIFFICULTY_HINTS: Record<number, { label: string; color: string; desc: string }> = {
  0:  { label: 'Невалидная', color: 'var(--red)',    desc: 'Цель не имеет смысла или невыполнима' },
  1:  { label: 'Очень легко', color: 'var(--green)',  desc: 'Требует минимум усилий' },
  2:  { label: 'Легко',       color: 'var(--green)',  desc: '×1 LIT' },
  3:  { label: 'Легко',       color: 'var(--green)',  desc: '×1 LIT' },
  4:  { label: 'Средне',      color: 'var(--yellow)', desc: '×3 LIT' },
  5:  { label: 'Средне',      color: 'var(--yellow)', desc: '×3 LIT' },
  6:  { label: 'Средне',      color: 'var(--yellow)', desc: '×3 LIT' },
  7:  { label: 'Сложно',      color: 'var(--orange)', desc: '×8 LIT' },
  8:  { label: 'Сложно',      color: 'var(--orange)', desc: '×8 LIT' },
  9:  { label: 'Очень сложно', color: 'var(--orange)', desc: '×8 LIT' },
  10: { label: 'Легенда',     color: '#a78bfa',       desc: '×20 LIT — максимальный множитель' },
};

export default function WatchPage() {
  const [pairStatus, setPairStatus] = useState<PairStatus | null>(null);
  const [students, setStudents] = useState<WatcherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficultyGoal, setDifficultyGoal] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    Promise.all([pairsApi.current(), pairsApi.myStudents()])
      .then(([pair, studs]) => {
        setPairStatus(pair.data);
        setStudents(studs.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const reviewGoals = students.flatMap(ws =>
    ws.student.activeGoals.filter(g => g.status === 'on_review')
  );

  async function handleDifficultySet(goalId: number, difficulty: number) {
    await goalsApi.setDifficulty(goalId, difficulty);
    setDifficultyGoal(null);
    const { data } = await pairsApi.myStudents();
    setStudents(data);
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ padding: '24px 16px 12px' }}>
        <h1 className="title-lg">Слежу</h1>
        <p className="body-sm text-faint mt-2">Партнёры и их прогресс</p>
      </div>

      {/* Review alert */}
      <AnimatePresence>
        {reviewGoals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ margin: '0 16px 16px' }}
          >
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(255,214,10,0.08)',
                border: '1px solid rgba(255,214,10,0.25)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <AlertCircle size={18} color="var(--yellow)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)', marginBottom: 2 }}>
                  Нужна твоя оценка
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,214,10,0.7)', lineHeight: 1.4 }}>
                  {reviewGoals.length} {reviewGoals.length === 1 ? 'цель ждёт' : 'цели ждут'} оценки сложности — нажми на карточку
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My watcher */}
      {pairStatus?.asStudent && (
        <div style={{ margin: '0 16px 20px' }}>
          <div className="label text-faint mb-3">Мой смотрящий</div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card card-border-gradient"
          >
            <div className="flex items-center gap-3">
              <UserAvatar user={pairStatus.asStudent.watcher} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title-sm truncate">
                  {pairStatus.asStudent.watcher.displayName ?? pairStatus.asStudent.watcher.username ?? 'Партнёр'}
                </div>
                {pairStatus.asStudent.watcher.username && (
                  <div className="body-sm text-faint mt-1">@{pairStatus.asStudent.watcher.username}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span className="badge badge-green">Активен</span>
                <span className="caption text-faint">Lvl {pairStatus.asStudent.watcher.level}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Queue banner */}
      {pairStatus?.inQueue && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ margin: '0 16px 20px' }}
        >
          <div className="banner-info">
            <div
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Eye size={18} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>В очереди поиска</div>
              <div style={{ fontSize: 12, color: 'rgba(129,140,248,0.6)', marginTop: 2 }}>Ищем тебе партнёра...</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Students */}
      <div style={{ margin: '0 16px' }}>
        <div className="label text-faint mb-3">Мои ученики</div>
        {students.length === 0 ? (
          <EmptyState />
        ) : (
          students.map((ws, i) => (
            <StudentCard
              key={ws.pairId}
              ws={ws}
              index={i}
              onReviewClick={goal => setDifficultyGoal(goal)}
            />
          ))
        )}
      </div>

      {/* Difficulty modal */}
      <AnimatePresence>
        {difficultyGoal && (
          <DifficultyModal
            goal={difficultyGoal}
            onClose={() => setDifficultyGoal(null)}
            onSave={difficulty => handleDifficultySet(difficultyGoal.id, difficulty)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentCard({
  ws,
  index,
  onReviewClick,
}: {
  ws: WatcherStudent;
  index: number;
  onReviewClick: (goal: { id: number; title: string }) => void;
}) {
  const { student } = ws;
  const name = student.displayName ?? student.username ?? 'Студент';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="card"
      style={{ marginBottom: 12 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar user={student} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title-sm truncate">{name}</div>
          {student.username && <div className="body-sm text-faint mt-1">@{student.username}</div>}
        </div>
        <div className="badge badge-ghost" style={{ flexShrink: 0 }}>Lvl {student.level}</div>
      </div>

      {student.activeGoals.length === 0 ? (
        <div className="body-sm text-faint text-center" style={{ padding: '8px 0' }}>
          Нет активных целей
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {student.activeGoals.map(goal => {
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000);
            const needsReview = goal.status === 'on_review';

            return (
              <motion.div
                key={goal.id}
                whileTap={needsReview ? { scale: 0.98 } : undefined}
                onClick={() => needsReview && onReviewClick({ id: goal.id, title: goal.title })}
                style={{
                  padding: '10px 12px',
                  background: needsReview
                    ? 'rgba(255,214,10,0.06)'
                    : 'var(--surface-2)',
                  border: `1px solid ${needsReview ? 'rgba(255,214,10,0.2)' : 'transparent'}`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: needsReview ? 'pointer' : 'default',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-sm truncate" style={{ fontWeight: 500 }}>{goal.title}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div
                      className="flex items-center gap-1"
                      style={{ color: daysLeft <= 3 ? 'var(--yellow)' : 'var(--text-3)' }}
                    >
                      <Clock size={11} />
                      <span style={{ fontSize: 11 }}>
                        {daysLeft > 0 ? `${daysLeft}д` : 'Просрочена'}
                      </span>
                    </div>
                    {goal.checkinsCount > 0 && (
                      <div className="flex items-center gap-1 text-faint">
                        <TrendingUp size={11} />
                        <span style={{ fontSize: 11 }}>{goal.checkinsCount}</span>
                      </div>
                    )}
                  </div>
                </div>
                {needsReview ? (
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>Оценить</span>
                    <ChevronRight size={13} color="var(--yellow)" />
                  </div>
                ) : (
                  <GoalStatusDot status={goal.status} />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function GoalStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    in_progress: 'var(--accent)',
    on_check:    'var(--orange)',
    on_voting:   '#a78bfa',
    on_review:   'var(--yellow)',
    completed:   'var(--green)',
    failed:      'var(--red)',
  };
  return (
    <div
      style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: colors[status] ?? 'var(--text-3)',
      }}
    />
  );
}

function DifficultyModal({
  goal,
  onClose,
  onSave,
}: {
  goal: { id: number; title: string };
  onClose: () => void;
  onSave: (d: number) => Promise<void>;
}) {
  const [difficulty, setDifficulty] = useState(5);
  const [saving, setSaving] = useState(false);

  const hint = DIFFICULTY_HINTS[difficulty];

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(difficulty);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="modal-sheet"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      >
        <div className="modal-handle" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="title-md">Оценка сложности</h2>
            <p className="body-sm text-faint mt-1">Как сложна эта цель?</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Goal title */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--surface-2)',
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div className="label text-faint mb-1">Цель</div>
          <p className="body-sm" style={{ fontWeight: 500 }}>{goal.title}</p>
        </div>

        {/* Score display */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <motion.div
            key={difficulty}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ fontSize: 52, fontWeight: 800, color: hint.color, lineHeight: 1 }}
          >
            {difficulty}
          </motion.div>
          <motion.div
            key={difficulty + 'label'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: 15, fontWeight: 600, color: hint.color, marginTop: 4 }}
          >
            {hint.label}
          </motion.div>
          <div className="caption text-faint mt-2">{hint.desc}</div>
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 8 }}>
          <div className="score-track" style={{ marginBottom: 8 }}>
            <div
              className="score-track-fill"
              style={{
                width: `${(difficulty / 10) * 100}%`,
                background: `linear-gradient(90deg, ${hint.color}88, ${hint.color})`,
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={difficulty}
            onChange={e => setDifficulty(Number(e.target.value))}
          />
          <div className="flex justify-between mt-1">
            <span className="caption text-faint">0 — Невалид</span>
            <span className="caption text-faint">5 — Средне</span>
            <span className="caption text-faint">10 — Легенда</span>
          </div>
        </div>

        {/* Warning for 0 */}
        <AnimatePresence>
          {difficulty === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '10px 12px',
                background: 'rgba(255,69,58,0.08)',
                border: '1px solid rgba(255,69,58,0.2)',
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--red)',
                lineHeight: 1.5,
              }}
            >
              ⚠ Оценка 0 вернёт цель ученику на доработку. Используй только если цель невыполнима или бессмысленна.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 0.4 }}>
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1 }}
          >
            <Flame size={16} />
            {saving ? 'Сохраняю...' : `Поставить ×${difficulty === 0 ? 0 : difficulty <= 3 ? 1 : difficulty <= 6 ? 3 : difficulty <= 9 ? 8 : 20}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function UserAvatar({ user, size }: {
  user: { username?: string | null; displayName?: string | null; photoUrl?: string | null };
  size: number;
}) {
  const name = user.displayName ?? user.username ?? '?';
  const initials = name.slice(0, 2).toUpperCase();
  if (user.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      className="avatar-placeholder"
      style={{ width: size, height: size, fontSize: size * 0.35, flexShrink: 0 }}
    >
      {initials}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="empty-icon">
        <Eye size={28} color="var(--text-3)" />
      </div>
      <div>
        <h3 className="title-sm">Нет учеников</h3>
        <p className="body-sm text-faint mt-2">После матчинга здесь появятся твои ученики</p>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="page-content" style={{ padding: '24px 16px' }}>
      <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 24 }} />
      {[1, 2].map(i => (
        <div key={i} className="card" style={{ height: 120, marginBottom: 12 }} />
      ))}
    </div>
  );
}
