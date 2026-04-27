import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Star, Users, Zap, X, ChevronRight } from 'lucide-react';
import { teachersApi, type TeacherProfile } from '../api/client';
import { useAuthStore } from '../store';

export default function TeachersPage() {
  const { user } = useAuthStore();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeacherProfile | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [topicFilter, setTopicFilter] = useState('');

  useEffect(() => {
    loadTeachers();
  }, []);

  async function loadTeachers(topic?: string) {
    setLoading(true);
    try {
      const { data } = await teachersApi.list(topic ? { topic } : {});
      setTeachers(data);
    } finally {
      setLoading(false);
    }
  }

  const canApply = user && user.level >= 4 && user.rating >= 3.5 && user.totalGoalsCompleted >= 5 && !user.isTeacher;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 12 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="title-lg">Учителя</h1>
            <p className="body-sm text-faint mt-1">{teachers.length} доступн{teachers.length === 1 ? 'о' : 'о'}</p>
          </div>
          {canApply && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary btn-sm"
              onClick={() => setShowApply(true)}
            >
              Стать учителем
            </motion.button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Поиск по теме..."
          value={topicFilter}
          onChange={e => {
            setTopicFilter(e.target.value);
            if (!e.target.value) loadTeachers();
          }}
          onKeyDown={e => e.key === 'Enter' && loadTeachers(topicFilter)}
          style={{ minHeight: 42 }}
        />
      </div>

      {/* List */}
      {loading ? (
        <TeachersSkeleton />
      ) : teachers.length === 0 ? (
        <EmptyTeachers />
      ) : (
        <div className="px-4">
          {teachers.map((t, i) => (
            <TeacherCard
              key={t.id}
              teacher={t}
              index={i}
              onClick={() => setSelected(t)}
            />
          ))}
        </div>
      )}

      {/* Teacher detail */}
      <AnimatePresence>
        {selected && (
          <TeacherDetailModal teacher={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      {/* Apply modal */}
      <AnimatePresence>
        {showApply && (
          <ApplyTeacherModal onClose={() => setShowApply(false)} onApplied={() => { setShowApply(false); loadTeachers(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TeacherCard({ teacher, index, onClick }: { teacher: TeacherProfile; index: number; onClick: () => void }) {
  const { user } = teacher;
  const name = user.displayName ?? user.username ?? 'Учитель';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="card card-glow"
      onClick={onClick}
      style={{ marginBottom: 10, cursor: 'pointer' }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        {user.photoUrl ? (
          <img src={user.photoUrl} alt={name} style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div
            style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'var(--accent-grd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 700, color: '#fff',
            }}
          >
            {initials}
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <span className="title-sm truncate">{name}</span>
            <span className="badge badge-accent" style={{ fontSize: 9, padding: '1px 5px' }}>Lvl {user.level}</span>
          </div>
          <div className="body-sm text-faint truncate mt-1">{teacher.topic ?? 'Разные темы'}</div>
          <div className="flex items-center gap-3 mt-2">
            {user.teacherRating && (
              <div className="flex items-center gap-1">
                <Star size={12} color="#FFD60A" fill="#FFD60A" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{user.teacherRating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <Users size={12} />
              <span style={{ fontSize: 12 }}>{teacher.studentsCount}</span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              padding: '4px 10px',
              background: user.price === 0 ? 'rgba(48,209,88,0.12)' : 'rgba(99,102,241,0.12)',
              border: `1px solid ${user.price === 0 ? 'rgba(48,209,88,0.25)' : 'rgba(99,102,241,0.25)'}`,
              borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              color: user.price === 0 ? 'var(--green)' : '#818cf8',
            }}
          >
            {user.price === 0 ? 'Бесплатно' : `${user.price} LIT`}
          </div>
          {teacher.status === 'trial' && (
            <div className="caption text-faint mt-1">Испытательный</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TeacherDetailModal({ teacher, onClose }: { teacher: TeacherProfile; onClose: () => void }) {
  const name = teacher.user.displayName ?? teacher.user.username ?? 'Учитель';
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
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      >
        <div className="modal-handle" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="title-md">{name}</h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Topic */}
        <div className="badge badge-accent" style={{ marginBottom: 16, fontSize: 12, padding: '4px 10px' }}>
          {teacher.topic ?? 'Разные темы'}
        </div>

        {/* Description */}
        {teacher.description && (
          <div className="card" style={{ marginBottom: 12, padding: 12 }}>
            <div className="label text-faint" style={{ marginBottom: 6 }}>Описание</div>
            <p className="body-sm" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{teacher.description}</p>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <StatBubble label="Цели" value={teacher.user.totalGoalsCompleted} color="var(--green)" />
          <StatBubble label="Ученики" value={teacher.studentsCount} color="var(--accent)" />
          <StatBubble label="Рейтинг" value={teacher.user.rating.toFixed(1)} color="var(--yellow)" />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-ghost" style={{ flex: 0.4 }} onClick={onClose}>Закрыть</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
              onClose();
            }}
          >
            <Zap size={16} />
            Записаться · {teacher.user.price === 0 ? 'Бесплатно' : `${teacher.user.price} LIT`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ApplyTeacherModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!topic.trim() || description.trim().length < 20) {
      setErr('Заполни тему и описание (мин. 20 символов)');
      return;
    }
    setLoading(true);
    try {
      await teachersApi.apply(topic, description);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onApplied();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка';
      setErr(msg);
      setLoading(false);
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
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      >
        <div className="modal-handle" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="title-md">Стать учителем</h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex-col gap-3 flex">
          <label>
            <div className="label text-faint" style={{ marginBottom: 8 }}>Тема обучения *</div>
            <input
              className="input"
              placeholder="Программирование, Английский, Спорт..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </label>
          <label>
            <div className="label text-faint" style={{ marginBottom: 8 }}>Расскажи о себе *</div>
            <textarea
              className="input"
              placeholder="Опиши свой опыт, что умеешь, чем можешь помочь..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
            <span className="caption text-faint mt-1 block">{description.length}/1000</span>
          </label>
          {err && <div style={{ fontSize: 13, color: 'var(--red)' }}>{err}</div>}
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn btn-ghost" style={{ flex: 0.4 }} onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Отправляю...' : (
              <span className="flex items-center gap-2">Подать заявку <ChevronRight size={16} /></span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatBubble({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function EmptyTeachers() {
  return (
    <div className="empty-state">
      <div className="empty-icon"><BookOpen size={28} color="var(--text-3)" /></div>
      <div>
        <h3 className="title-sm">Нет учителей</h3>
        <p className="body-sm text-faint mt-1">Будь первым — стань учителем в своей теме</p>
      </div>
    </div>
  );
}

function TeachersSkeleton() {
  return (
    <div className="px-4 flex-col gap-3 flex">
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 90 }} />
      ))}
    </div>
  );
}
