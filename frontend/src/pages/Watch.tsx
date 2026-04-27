import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Clock, TrendingUp, AlertCircle, X, CheckCircle2, XCircle, Flame } from 'lucide-react';
import { pairsApi, goalsApi, type WatcherStudent, type PairStatus } from '../api/client';

const DIFFICULTY_ANCHORS = [
  { score: 0, label: 'Невалидная цель (вернуть автору)' },
  { score: 2, label: 'Встать в 6 утра 7 дней подряд' },
  { score: 4, label: 'Пробежать 5 км без остановки' },
  { score: 6, label: 'Написать и опубликовать статью' },
  { score: 8, label: 'Выучить 500 слов на иностранном языке' },
  { score: 10, label: 'Создать и задеплоить веб-приложение' },
];

function getDifficultyAnchor(score: number) {
  let best = DIFFICULTY_ANCHORS[0];
  for (const a of DIFFICULTY_ANCHORS) {
    if (Math.abs(a.score - score) < Math.abs(best.score - score)) best = a;
  }
  return best.label;
}

export default function WatchPage() {
  const [pairStatus, setPairStatus] = useState<PairStatus | null>(null);
  const [students, setStudents] = useState<WatcherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficultyGoal, setDifficultyGoal] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    Promise.all([pairsApi.current(), pairsApi.myStudents()]).then(([pair, studs]) => {
      setPairStatus(pair.data);
      setStudents(studs.data);
    }).finally(() => setLoading(false));
  }, []);

  function reload() {
    setLoading(true);
    Promise.all([pairsApi.current(), pairsApi.myStudents()]).then(([pair, studs]) => {
      setPairStatus(pair.data);
      setStudents(studs.data);
    }).finally(() => setLoading(false));
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 4 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Eye size={18} color="#818cf8" />
          </div>
          <div>
            <h1 className="title-lg">Слежу</h1>
            <p className="body-sm text-faint mt-1">Партнёры и их прогресс</p>
          </div>
        </div>
      </div>

      {/* Watcher pending difficulty ratings */}
      {students.some(ws => ws.student.activeGoals.some(g => g.status === 'on_review')) && (
        <div className="px-4" style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(255,159,10,0.08)',
              border: '1px solid rgba(255,159,10,0.25)',
              borderRadius: 14,
            }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
              <Flame size={14} color="var(--orange)" />
              <span className="label" style={{ color: 'var(--orange)' }}>Требуется оценка</span>
            </div>
            <p className="body-sm text-faint">Один из учеников отправил цель на оценку сложности. Нажми на цель чтобы оценить.</p>
          </div>
        </div>
      )}

      {/* My watcher */}
      {pairStatus?.asStudent && (
        <div className="px-4" style={{ marginBottom: 20 }}>
          <div className="label text-faint" style={{ marginBottom: 10 }}>Мой смотрящий</div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card card-border-gradient"
          >
            <div className="flex items-center gap-3">
              <Avatar user={pairStatus.asStudent.watcher} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="title-sm truncate">
                  {pairStatus.asStudent.watcher.displayName ?? pairStatus.asStudent.watcher.username ?? 'Партнёр'}
                </div>
                {pairStatus.asStudent.watcher.username && (
                  <div className="body-sm text-faint mt-1">@{pairStatus.asStudent.watcher.username}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="badge badge-green">Активен</span>
                <span className="caption text-faint">Lvl {pairStatus.asStudent.watcher.level}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Students I watch */}
      <div className="px-4">
        <div className="label text-faint" style={{ marginBottom: 10 }}>Мои ученики</div>
        {students.length === 0 ? (
          <EmptyState />
        ) : (
          students.map((ws, i) => (
            <StudentCard
              key={ws.pairId}
              ws={ws}
              index={i}
              onRateDifficulty={goal => setDifficultyGoal(goal)}
            />
          ))
        )}
      </div>

      {/* In queue banner */}
      {pairStatus?.inQueue && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{ margin: '16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--accent-grd-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} color="#818cf8" />
            </div>
            <div>
              <div className="title-sm">В очереди поиска</div>
              <div className="body-sm text-faint mt-1">Ищем тебе партнёра...</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Difficulty rating modal */}
      <AnimatePresence>
        {difficultyGoal && (
          <DifficultyModal
            goalId={difficultyGoal.id}
            goalTitle={difficultyGoal.title}
            onClose={() => setDifficultyGoal(null)}
            onDone={() => { setDifficultyGoal(null); reload(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentCard({
  ws, index, onRateDifficulty,
}: {
  ws: WatcherStudent;
  index: number;
  onRateDifficulty: (goal: { id: number; title: string }) => void;
}) {
  const { student } = ws;
  const name = student.displayName ?? student.username ?? 'Студент';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="card"
      style={{ marginBottom: 12 }}
    >
      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <Avatar user={student} size={40} />
        <div style={{ flex: 1 }}>
          <div className="title-sm">{name}</div>
          {student.username && <div className="body-sm text-faint">@{student.username}</div>}
        </div>
        <div className="badge badge-ghost" style={{ fontSize: 11 }}>Lvl {student.level}</div>
      </div>

      {student.activeGoals.length === 0 ? (
        <div className="body-sm text-faint text-center" style={{ padding: '8px 0' }}>
          Нет активных целей
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {student.activeGoals.map(goal => {
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000);
            const needsRating = goal.status === 'on_review';
            return (
              <motion.div
                key={goal.id}
                whileTap={needsRating ? { scale: 0.97 } : {}}
                onClick={needsRating ? () => onRateDifficulty({ id: goal.id, title: goal.title }) : undefined}
                style={{
                  padding: '10px 12px',
                  background: needsRating ? 'rgba(255,159,10,0.06)' : 'var(--surface-2)',
                  border: needsRating ? '1px solid rgba(255,159,10,0.25)' : '1px solid transparent',
                  borderRadius: 10,
                  cursor: needsRating ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
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
                      <span style={{ fontSize: 11 }}>{daysLeft}д</span>
                    </div>
                    {goal.checkinsCount > 0 && (
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        <TrendingUp size={11} />
                        <span style={{ fontSize: 11 }}>{goal.checkinsCount}</span>
                      </div>
                    )}
                    {needsRating && (
                      <span
                        style={{
                          fontSize: 10, fontWeight: 600,
                          color: 'var(--orange)',
                          background: 'rgba(255,159,10,0.12)',
                          padding: '2px 6px',
                          borderRadius: 6,
                        }}
                      >
                        Оценить сложность →
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function DifficultyModal({
  goalId, goalTitle, onClose, onDone,
}: {
  goalId: number;
  goalTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [difficulty, setDifficulty] = useState(5);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!touched) return;
    setLoading(true);
    try {
      await goalsApi.setDifficulty(goalId, difficulty);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const isInvalid = difficulty === 0;

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

        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="title-md">Оценить сложность</h2>
            <p className="body-sm text-faint mt-1">Смотрящий выставляет сложность цели</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Goal */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--surface-2)',
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div className="label text-faint" style={{ marginBottom: 6 }}>Цель ученика</div>
          <p className="body-sm" style={{ fontWeight: 500 }}>{goalTitle}</p>
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 16 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
            <span className="label text-faint">Сложность</span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: !touched ? 'var(--text-3)' :
                  difficulty === 0 ? 'var(--red)' :
                  difficulty <= 3 ? 'var(--yellow)' :
                  difficulty <= 6 ? 'var(--orange)' :
                  difficulty <= 9 ? 'var(--accent)' : '#a78bfa',
                lineHeight: 1,
                transition: 'color 0.2s',
              }}
            >
              {difficulty}/10
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={difficulty}
            onChange={e => { setDifficulty(Number(e.target.value)); setTouched(true); }}
            style={{ width: '100%' }}
          />
          <div className="flex justify-between" style={{ marginTop: 4 }}>
            {[0,2,4,6,8,10].map(v => (
              <span key={v} style={{ fontSize: 10, color: 'var(--text-4)' }}>{v}</span>
            ))}
          </div>
        </div>

        {/* Anchor hint */}
        <div
          style={{
            padding: '10px 14px',
            background: isInvalid && touched ? 'rgba(255,69,58,0.08)' : 'var(--surface-2)',
            border: isInvalid && touched ? '1px solid rgba(255,69,58,0.2)' : '1px solid var(--border)',
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 13,
            color: isInvalid && touched ? 'var(--red)' : 'var(--text-2)',
            lineHeight: 1.5,
          }}
        >
          {touched ? (
            isInvalid
              ? '⚠️ Цель 0 = невалидная. Будет возвращена ученику с комментарием. Укажи причину ниже.'
              : `💡 ${getDifficultyAnchor(difficulty)}`
          ) : (
            'Подвигай ползунок — 0 означает невалидная цель'
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 0.4 }}>
            Отмена
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            className={`btn ${isInvalid && touched ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSubmit}
            disabled={!touched || loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? 'Отправляю...' : isInvalid && touched ? (
              <><XCircle size={16} /> Вернуть как невалидную</>
            ) : (
              <><CheckCircle2 size={16} /> Подтвердить оценку</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Avatar({ user, size }: { user: { username?: string | null; displayName?: string | null; photoUrl?: string | null }; size: number }) {
  const name = user.displayName ?? user.username ?? '?';
  const initials = name.slice(0, 2).toUpperCase();
  if (user.photoUrl) {
    return <img src={user.photoUrl} alt={name} className="avatar" style={{ width: size, height: size, borderRadius: '50%' }} />;
  }
  return (
    <div className="avatar-placeholder" style={{ width: size, height: size, fontSize: size * 0.35, fontWeight: 700 }}>
      {initials}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="empty-icon"><Eye size={28} color="var(--text-3)" /></div>
      <div>
        <h3 className="title-sm">Нет учеников</h3>
        <p className="body-sm text-faint mt-1">После матчинга здесь появятся твои ученики</p>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="page-content px-4" style={{ paddingTop: 24 }}>
      <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 20 }} />
      {[1, 2].map(i => (
        <div key={i} className="card" style={{ height: 120, marginBottom: 12 }} />
      ))}
    </div>
  );
}
