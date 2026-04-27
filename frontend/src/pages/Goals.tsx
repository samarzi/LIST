import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronRight, CheckCircle2, Upload } from 'lucide-react';
import { goalsApi, type Goal, type CreateGoalDto } from '../api/client';
import { useAuthStore } from '../store';
import GoalCard from '../components/GoalCard';
import ProfileCard from '../components/ProfileCard';

const PROOF_TYPES = [
  { id: 'screenshot', label: '📸 Скриншот' },
  { id: 'video', label: '🎥 Видео' },
  { id: 'link', label: '🔗 Ссылка' },
  { id: 'document', label: '📄 Документ' },
  { id: 'combined', label: '🎯 Комбо' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активные' },
  { id: 'completed', label: 'Выполнено' },
];

export default function GoalsPage() {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const { data } = await goalsApi.list();
      setGoals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = goals.filter(g => {
    if (filter === 'active') return ['in_progress', 'on_check', 'on_voting', 'on_review'].includes(g.status);
    if (filter === 'completed') return g.status === 'completed';
    return true;
  });

  return (
    <div className="page-content">
      {/* Profile */}
      {user && (
        <div style={{ paddingTop: 16, paddingBottom: 12 }}>
          <ProfileCard user={user} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title-md">Мои цели</h1>
          <p className="body-sm text-faint mt-1">{goals.length} цел{goals.length === 1 ? 'ь' : 'и'}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(true)}
          style={{ gap: 6 }}
        >
          <Plus size={16} />
          Новая
        </motion.button>
      </div>

      {/* Filters */}
      <div
        className="flex gap-2 px-4"
        style={{ marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}
      >
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              background: filter === f.id ? 'var(--accent)' : 'var(--surface-2)',
              color: filter === f.id ? '#fff' : 'var(--text-2)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Goals list */}
      <div className="px-4">
        {loading ? (
          <GoalsSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyGoals onAdd={() => setShowCreate(true)} />
        ) : (
          filtered.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              onClick={() => setSelectedGoal(goal)}
            />
          ))
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateGoalModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); loadGoals(); }}
          />
        )}
      </AnimatePresence>

      {/* Goal detail modal */}
      <AnimatePresence>
        {selectedGoal && (
          <GoalDetailModal
            goal={selectedGoal}
            onClose={() => setSelectedGoal(null)}
            onUpdate={loadGoals}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateGoalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<CreateGoalDto>>({ proofType: 'screenshot' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = [
    { title: 'Цель', field: 'title' },
    { title: 'Критерии', field: 'successCriteria' },
    { title: 'Детали', field: 'details' },
    { title: 'Тип доказательства', field: 'proofType' },
  ];

  function set(key: keyof CreateGoalDto, value: string) {
    setForm(p => ({ ...p, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function validate(): boolean {
    if (step === 0 && (!form.title || form.title.length < 3)) {
      setErrors({ title: 'Минимум 3 символа' });
      return false;
    }
    if (step === 1 && (!form.successCriteria || form.successCriteria.length < 30)) {
      setErrors({ successCriteria: 'Минимум 30 символов — опиши конкретно' });
      return false;
    }
    if (step === 2 && !form.deadline) {
      setErrors({ deadline: 'Укажи дедлайн' });
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (step < 3) { setStep(s => s + 1); return; }

    if (!form.title || !form.successCriteria || !form.deadline || !form.proofType) return;
    setLoading(true);
    try {
      await goalsApi.create(form as CreateGoalDto);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onCreated();
    } catch {
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
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      >
        <div className="modal-handle" />

        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h2 className="title-md">Новая цель</h2>
            <p className="body-sm text-faint mt-1">Шаг {step + 1} из 4</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="progress-track" style={{ marginBottom: 24 }}>
          <motion.div
            className="progress-fill"
            animate={{ width: `${((step + 1) / 4) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && (
              <div className="flex-col gap-3 flex">
                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>Что конкретно сделаю?</div>
                  <textarea
                    className="input"
                    placeholder="Создам работающее веб-приложение с авторизацией"
                    value={form.title ?? ''}
                    onChange={e => set('title', e.target.value)}
                    maxLength={100}
                    rows={3}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.title && <span style={{ fontSize: 12, color: 'var(--red)' }}>{errors.title}</span>}
                    <span className="caption text-faint" style={{ marginLeft: 'auto' }}>{(form.title ?? '').length}/100</span>
                  </div>
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="flex-col gap-3 flex">
                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>Как измерю результат?</div>
                  <textarea
                    className="input"
                    placeholder="Приложение задеплоено на хостинге, есть ссылка, работает регистрация и вход"
                    value={form.successCriteria ?? ''}
                    onChange={e => set('successCriteria', e.target.value)}
                    maxLength={300}
                    rows={4}
                    style={{ minHeight: 100 }}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.successCriteria && <span style={{ fontSize: 12, color: 'var(--red)' }}>{errors.successCriteria}</span>}
                    <span className="caption text-faint" style={{ marginLeft: 'auto' }}>{(form.successCriteria ?? '').length}/300</span>
                  </div>
                </label>

                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>Зачем мне это? (опционально)</div>
                  <textarea
                    className="input"
                    placeholder="Хочу запустить свой продукт..."
                    value={form.motivation ?? ''}
                    onChange={e => set('motivation', e.target.value)}
                    maxLength={200}
                    rows={2}
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="flex-col gap-3 flex">
                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>План действий (опционально)</div>
                  <textarea
                    className="input"
                    placeholder="1. Настрою окружение&#10;2. Напишу бэкенд&#10;3. Сделаю деплой"
                    value={form.actionPlan ?? ''}
                    onChange={e => set('actionPlan', e.target.value)}
                    maxLength={500}
                    rows={4}
                  />
                </label>

                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>Дедлайн *</div>
                  <input
                    type="date"
                    className="input"
                    value={form.deadline ?? ''}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => set('deadline', e.target.value)}
                    style={{ colorScheme: 'dark' }}
                  />
                  {errors.deadline && <span style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, display: 'block' }}>{errors.deadline}</span>}
                </label>

                <label>
                  <div className="label text-faint" style={{ marginBottom: 8 }}>Ставка LIT (опционально)</div>
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    min={0}
                    value={form.stakeLit ?? ''}
                    onChange={e => setForm(p => ({ ...p, stakeLit: Number(e.target.value) }))}
                  />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="flex-col gap-2 flex">
                <div className="label text-faint" style={{ marginBottom: 8 }}>Тип доказательства</div>
                {PROOF_TYPES.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => set('proofType', pt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: form.proofType === pt.id ? 'rgba(99,102,241,0.15)' : 'var(--surface-2)',
                      border: `1px solid ${form.proofType === pt.id ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      color: form.proofType === pt.id ? '#818cf8' : 'var(--text)',
                      fontSize: 15,
                      fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                  >
                    {pt.label}
                    {form.proofType === pt.id && <CheckCircle2 size={16} color="#818cf8" />}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2" style={{ marginTop: 24 }}>
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)} style={{ flex: 0.4 }}>
              Назад
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? 'Создаю...' : step === 3 ? 'Создать цель' : (
              <span className="flex items-center gap-2">
                Далее <ChevronRight size={16} />
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoalDetailModal({ goal, onClose, onUpdate }: { goal: Goal; onClose: () => void; onUpdate: () => void }) {
  const [checkinText, setCheckinText] = useState('');
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [proofText, setProofText] = useState('');

  const deadline = new Date(goal.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  async function submitCheckin() {
    if (!checkinText.trim()) return;
    setLoadingCheckin(true);
    try {
      await goalsApi.checkin(goal.id, checkinText);
      setCheckinText('');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onUpdate();
    } finally {
      setLoadingCheckin(false);
    }
  }

  async function submitProof() {
    if (!proofText.trim()) return;
    try {
      await goalsApi.submitProof(goal.id, { description: proofText });
      setShowProof(false);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onUpdate();
      onClose();
    } catch {}
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
        style={{ maxHeight: '90vh' }}
      >
        <div className="modal-handle" />
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 className="title-sm" style={{ flex: 1, marginRight: 8 }}>{goal.title}</h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 mb-4">
          <span className="badge badge-accent">{goal.status}</span>
          <span className="caption text-faint">
            {daysLeft > 0 ? `${daysLeft}д до дедлайна` : daysLeft === 0 ? 'Сегодня!' : 'Просрочена'}
          </span>
          {goal.checkinsCount > 0 && (
            <span className="caption text-faint">• {goal.checkinsCount} чекинов</span>
          )}
        </div>

        {/* Criteria */}
        <div className="card" style={{ marginBottom: 12, padding: 12 }}>
          <div className="label text-faint" style={{ marginBottom: 6 }}>Критерии успеха</div>
          <p className="body-sm" style={{ color: 'var(--text-2)' }}>{goal.successCriteria}</p>
        </div>

        {/* Checkin block */}
        {goal.status === 'in_progress' && !showProof && (
          <div style={{ marginBottom: 12 }}>
            <div className="label text-faint" style={{ marginBottom: 8 }}>Сделать чекин</div>
            <textarea
              className="input"
              placeholder="Что сделал сегодня..."
              value={checkinText}
              onChange={e => setCheckinText(e.target.value)}
              rows={2}
              style={{ marginBottom: 8 }}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={submitCheckin}
                disabled={loadingCheckin || !checkinText.trim()}
                style={{ flex: 1 }}
              >
                {loadingCheckin ? 'Отправляю...' : '✓ Отправить чекин'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowProof(true)}
              >
                <Upload size={16} />
                Выполнено
              </button>
            </div>
          </div>
        )}

        {/* Proof submission */}
        {showProof && (
          <div style={{ marginBottom: 12 }}>
            <div className="label text-faint" style={{ marginBottom: 8 }}>Доказательство выполнения</div>
            <textarea
              className="input"
              placeholder="Опиши что сделал, добавь ссылки на доказательства..."
              value={proofText}
              onChange={e => setProofText(e.target.value)}
              rows={4}
              style={{ marginBottom: 8 }}
            />
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setShowProof(false)} style={{ flex: 0.4 }}>
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={submitProof}
                disabled={proofText.trim().length < 10}
                style={{ flex: 1 }}
              >
                Подать на проверку
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function GoalsSkeleton() {
  return (
    <div className="flex-col gap-3 flex">
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 100 }}>
          <div className="skeleton" style={{ width: '30%', height: 20, marginBottom: 10 }} />
          <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '50%', height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyGoals({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="empty-icon" style={{ background: 'var(--accent-grd-soft)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 28 }}>🎯</span>
      </div>
      <div>
        <h3 className="title-sm" style={{ marginBottom: 6 }}>Нет целей</h3>
        <p className="body-sm text-faint">Поставь первую цель и начни двигаться вперёд</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.96 }}
        className="btn btn-primary"
        onClick={onAdd}
      >
        <Plus size={18} />
        Поставить цель
      </motion.button>
    </motion.div>
  );
}
