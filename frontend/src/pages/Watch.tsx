import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, User, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { pairsApi, type WatcherStudent, type PairStatus } from '../api/client';

export default function WatchPage() {
  const [pairStatus, setPairStatus] = useState<PairStatus | null>(null);
  const [students, setStudents] = useState<WatcherStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([pairsApi.current(), pairsApi.myStudents()]).then(([pair, studs]) => {
      setPairStatus(pair.data);
      setStudents(studs.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 12 }}>
        <h1 className="title-lg">Слежу</h1>
        <p className="body-sm text-faint mt-1">Партнёры и их прогресс</p>
      </div>

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
                  <div className="body-sm text-faint">@{pairStatus.asStudent.watcher.username}</div>
                )}
              </div>
              <div className="flex-col" style={{ alignItems: 'flex-end', gap: 4, display: 'flex' }}>
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
            <StudentCard key={ws.pairId} ws={ws} index={i} />
          ))
        )}
      </div>

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
    </div>
  );
}

function StudentCard({ ws, index }: { ws: WatcherStudent; index: number }) {
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
      {/* Student info */}
      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <Avatar user={student} size={40} />
        <div style={{ flex: 1 }}>
          <div className="title-sm">{name}</div>
          {student.username && <div className="body-sm text-faint">@{student.username}</div>}
        </div>
        <div className="badge badge-ghost" style={{ fontSize: 11 }}>Lvl {student.level}</div>
      </div>

      {/* Active goals */}
      {student.activeGoals.length === 0 ? (
        <div className="body-sm text-faint text-center" style={{ padding: '8px 0' }}>
          Нет активных целей
        </div>
      ) : (
        <div className="flex-col gap-2 flex">
          {student.activeGoals.map(goal => {
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000);
            return (
              <div
                key={goal.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-sm truncate" style={{ fontWeight: 500 }}>{goal.title}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1" style={{ color: daysLeft <= 3 ? 'var(--yellow)' : 'var(--text-3)' }}>
                      <Clock size={11} />
                      <span style={{ fontSize: 11 }}>{daysLeft}д</span>
                    </div>
                    {goal.checkinsCount > 0 && (
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        <TrendingUp size={11} />
                        <span style={{ fontSize: 11 }}>{goal.checkinsCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    <div
      className="avatar-placeholder"
      style={{ width: size, height: size, fontSize: size * 0.35, fontWeight: 700 }}
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
