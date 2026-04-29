import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronRight, Flame, ImageIcon, Video, LinkIcon, Paperclip, CheckCircle2, Upload, Trash2, CheckSquare, Repeat, Check, Info } from 'lucide-react';
import { goalsApi, uploadApi, type Goal, type CreateGoalDto } from '../api/client';
import { useAuthStore, useUIStore, useGoalsStore } from '../store';
import { tasksApi, habitsApi, type Task, type Habit } from '../api/client';

const STATUS_LABELS: Record<string, string> = {
  draft:       'Черновик',
  on_review:   'На оценке',
  in_progress: 'В процессе',
  on_check:    'На проверке',
  on_voting:   'Голосование',
  completed:   'Выполнено',
  failed:      'Провалено',
  rejected:    'Отклонено',
};

const PROOF_TYPES = [
  { id: 'screenshot', label: '📸 Скриншот' },
  { id: 'video', label: '🎥 Видео' },
  { id: 'link', label: '🔗 Ссылка' },
  { id: 'document', label: '📄 Документ' },
  { id: 'combined', label: '🎯 Комбо' },
];

const STATUS_FILTERS = [
  { id: 'all',       label: 'Все' },
  { id: 'active',    label: 'Активные' },
  { id: 'completed', label: 'Выполнено' },
  { id: 'failed',    label: 'Провалено' },
];

export default function GoalsPage() {
  const { user } = useAuthStore();
  const { goals, setGoals, addGoal, updateGoal } = useGoalsStore();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [activeTab, setActiveTab] = useState<'goals' | 'tasks' | 'habits'>('goals');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []); // Load on mount only

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user?.id]); // Reload when user changes

  async function deleteGoal(goalId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Удалить цель?')) return;
    try {
      await goalsApi.delete(goalId);
      setGoals(goals.filter(g => g.id !== goalId));
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Ошибка удаления');
    }
  }

  async function loadGoals() {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await goalsApi.list();
      console.log('Loaded goals:', data.length, 'for user:', currentUser.id);
      setGoals(data);
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = goals.filter(g => {
    if (filter === 'active') return ['in_progress', 'on_check', 'on_voting', 'on_review'].includes(g.status);
    if (filter === 'completed') return g.status === 'completed';
    if (filter === 'failed') return ['failed', 'rejected'].includes(g.status);
    return true;
  });

  const tabs = [
    { id: 'goals' as const, label: 'Цели', icon: Flame },
    { id: 'tasks' as const, label: 'Задачи', icon: CheckSquare },
    { id: 'habits' as const, label: 'Привычки', icon: Repeat },
  ];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between px-4" style={{ marginBottom: 12, paddingTop: 16 }}>
        <div>
          <h1 className="title-lg text-gradient">Путь</h1>
          <p className="body-sm text-faint mt-1">Твои цели, задачи и привычки</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowInfo(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'var(--surface-2)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
          }}
        >
          <Info size={18} />
        </motion.button>
      </div>

      {/* Tabs */}
      <div style={{ margin: '0 16px 16px' }}>
        <div className="flex gap-2" style={{ background: 'var(--surface-2)', padding: 4, borderRadius: 12 }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: isActive ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'goals' && (
          <>
            {/* Filters */}
            <div
              className="flex gap-2 px-4"
              style={{ marginBottom: 16 }}
            >
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: 20,
                    border: 'none',
                    background: filter === f.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: filter === f.id ? '#fff' : 'var(--text-2)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    textAlign: 'center',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filtered.map((goal, i) => (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card"
                      style={{ padding: '14px 16px', cursor: 'pointer' }}
                      onClick={() => setSelectedGoal(goal)}
                    >
                      <div className="flex items-center justify-between">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="body-sm" style={{ fontWeight: 600, marginBottom: 4 }}>{goal.title}</div>
                          <div className="caption text-faint">{STATUS_LABELS[goal.status] || goal.status}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {goal.status !== 'completed' && (
                            <button
                              onClick={(e) => deleteGoal(goal.id, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-3)' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          <ChevronRight size={18} color="var(--text-3)" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {activeTab === 'tasks' && <TasksTracker />}
        {activeTab === 'habits' && <HabitsTracker />}
      </motion.div>

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

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: 16,
            }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)',
                borderRadius: 20,
                padding: 24,
                width: '100%',
                maxWidth: 380,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="title-lg">О разделе Путь</h2>
                <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="var(--text-2)" />
                </button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Цели:</strong> Ставь амбициозные цели, получай сложность от партнера и докажи их выполнение с доказательствами.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Задачи:</strong> Веди список задач для ежедневной продуктивности и отслеживай их выполнение.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Привычки:</strong> Формируй полезные привычки и отслеживай их выполнение по дням недели.
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  Все это поможет тебе систематически развиваться и достигать результатов!
                </p>
              </div>
            </motion.div>
          </motion.div>
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
                    onChange={e => setForm((p: any) => ({ ...p, stakeLit: Number(e.target.value) }))}
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
  const [checkinFiles, setCheckinFiles] = useState<File[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const deadline = new Date(goal.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  async function handleFileUpload(files: File[], isProof: boolean) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { data } = await uploadApi.uploadMultiple(files);
      const urls = data.files.map(f => f.url);
      if (isProof) {
        setProofFiles(prev => [...prev, ...files]);
      } else {
        setCheckinFiles(prev => [...prev, ...files]);
      }
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      console.error('Upload failed:', err);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setUploading(false);
    }
  }

  function addLink() {
    if (linkInput.trim() && links.length < 6) {
      setLinks([...links, linkInput.trim()]);
      setLinkInput('');
    }
  }

  function removeLink(index: number) {
    setLinks(links.filter((_, i) => i !== index));
  }

  async function submitCheckin() {
    if (!checkinText.trim() && checkinFiles.length === 0 && links.length === 0) return;
    setLoadingCheckin(true);
    try {
      const mediaUrls: string[] = [];
      
      // Upload files if any
      if (checkinFiles.length > 0) {
        const { data } = await uploadApi.uploadMultiple(checkinFiles);
        mediaUrls.push(...data.files.map(f => f.url));
      }
      
      // Add links
      mediaUrls.push(...links);
      
      await goalsApi.checkin(goal.id, checkinText, mediaUrls);
      setCheckinText('');
      setCheckinFiles([]);
      setLinks([]);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onUpdate();
    } finally {
      setLoadingCheckin(false);
    }
  }

  async function submitProof() {
    if (!proofText.trim() && proofFiles.length === 0 && links.length === 0) return;
    try {
      const mediaUrls: string[] = [];
      
      // Upload files if any
      if (proofFiles.length > 0) {
        const { data } = await uploadApi.uploadMultiple(proofFiles);
        mediaUrls.push(...data.files.map(f => f.url));
      }
      
      // Add links
      mediaUrls.push(...links);
      
      await goalsApi.submitProof(goal.id, { description: proofText, mediaUrls });
      setShowProof(false);
      setProofText('');
      setProofFiles([]);
      setLinks([]);
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
          <span className="badge badge-accent">{STATUS_LABELS[goal.status] ?? goal.status}</span>
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
            
            {/* File upload for checkin */}
            <div style={{ marginBottom: 8 }}>
              <input
                type="file"
                id="checkin-files"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (checkinFiles.length + files.length <= 6) {
                    setCheckinFiles(prev => [...prev, ...files]);
                  }
                }}
              />
              <label
                htmlFor="checkin-files"
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Paperclip size={14} />
                Прикрепить файлы ({checkinFiles.length}/6)
              </label>
              {checkinFiles.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {checkinFiles.map((file, i) => (
                    <span key={i} className="badge" style={{ fontSize: 11 }}>
                      {file.name}
                      <button
                        onClick={() => setCheckinFiles(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ marginLeft: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Link input for checkin */}
            <div style={{ marginBottom: 8 }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Вставь ссылку..."
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addLink()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-ghost"
                  onClick={addLink}
                  disabled={links.length >= 6}
                >
                  <LinkIcon size={14} />
                </button>
              </div>
              {links.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {links.map((link, i) => (
                    <span key={i} className="badge" style={{ fontSize: 11 }}>
                      <LinkIcon size={10} style={{ marginRight: 4 }} />
                      {link.substring(0, 20)}...
                      <button
                        onClick={() => removeLink(i)}
                        style={{ marginLeft: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={submitCheckin}
                disabled={loadingCheckin || (!checkinText.trim() && checkinFiles.length === 0 && links.length === 0)}
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
            
            {/* File upload for proof */}
            <div style={{ marginBottom: 8 }}>
              <input
                type="file"
                id="proof-files"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (proofFiles.length + files.length <= 6) {
                    setProofFiles(prev => [...prev, ...files]);
                  }
                }}
              />
              <label
                htmlFor="proof-files"
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Paperclip size={14} />
                Прикрепить файлы ({proofFiles.length}/6)
              </label>
              {proofFiles.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {proofFiles.map((file, i) => (
                    <span key={i} className="badge" style={{ fontSize: 11 }}>
                      {file.name}
                      <button
                        onClick={() => setProofFiles(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ marginLeft: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Link input for proof */}
            <div style={{ marginBottom: 8 }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Вставь ссылку..."
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addLink()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-ghost"
                  onClick={addLink}
                  disabled={links.length >= 6}
                >
                  <LinkIcon size={14} />
                </button>
              </div>
              {links.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {links.map((link, i) => (
                    <span key={i} className="badge" style={{ fontSize: 11 }}>
                      <LinkIcon size={10} style={{ marginRight: 4 }} />
                      {link.substring(0, 20)}...
                      <button
                        onClick={() => removeLink(i)}
                        style={{ marginLeft: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => setShowProof(false)} style={{ flex: 0.4 }}>
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={submitProof}
                disabled={uploading || (!proofText.trim() && proofFiles.length === 0 && links.length === 0)}
                style={{ flex: 1 }}
              >
                {uploading ? 'Загрузка...' : 'Подать на проверку'}
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

function TasksTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        tasksApi.list(false),
        tasksApi.list(true),
      ]);
      setTasks(activeRes.data);
      setArchivedTasks(archivedRes.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      // Устанавливаем пустые массивы при ошибке
      setTasks([]);
      setArchivedTasks([]);
    } finally {
      setLoading(false);
    }
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    try {
      await tasksApi.create({
        title: newTaskTitle,
        description: newTaskDesc,
        deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : undefined,
      });
      await loadTasks();
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDeadline('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  }

  async function toggleTask(id: number, completed: boolean) {
    try {
      await tasksApi.update(id, { completed: !completed });
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  }

  async function deleteTask(id: number) {
    if (!window.confirm('Удалить задачу? Это действие нельзя отменить.')) return;
    try {
      await tasksApi.delete(id);
      setTasks(tasks.filter(t => t.id !== id));
      setArchivedTasks(archivedTasks.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }

  async function addSubtask(taskId: number) {
    const title = (subtaskInputs[taskId] ?? '').trim();
    if (!title) return;
    try {
      await tasksApi.createSubtask(taskId, title);
      setSubtaskInputs(prev => ({ ...prev, [taskId]: '' }));
      await loadTasks();
    } catch (err) {
      console.error('Failed to add subtask:', err);
    }
  }

  async function toggleSubtask(taskId: number, subtaskId: number, completed: boolean) {
    try {
      await tasksApi.updateSubtask(taskId, subtaskId, { completed: !completed });
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  }

  async function deleteSubtask(taskId: number, subtaskId: number) {
    try {
      await tasksApi.deleteSubtask(taskId, subtaskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    }
  }

  if (loading) return <TasksSkeleton />;

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => setShowAddModal(true)}
        className="btn btn-primary btn-full"
        style={{ marginBottom: 16 }}
      >
        <Plus size={16} />
        Добавить задачу
      </button>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><CheckSquare size={28} color="var(--text-3)" /></div>
          <div>
            <h3 className="title-sm">Нет задач</h3>
            <p className="body-sm text-faint mt-1">Добавь первую задачу для отслеживания</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.6 : 1,
              }}
            >
              <button
                onClick={() => toggleTask(task.id, task.completed)}
                style={{
                  width: 24, height: 24,
                  borderRadius: 6,
                  border: `2px solid ${task.completed ? 'var(--green)' : 'var(--border)'}`,
                  background: task.completed ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {task.completed && <Check size={14} color="#fff" />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="body-sm" style={{ fontWeight: 500 }}>{task.title}</div>
                {task.description && (
                  <div className="caption text-faint mt-1">{task.description}</div>
                )}
                {task.deadline && (
                  <div className="caption text-faint mt-1">
                    Дедлайн: {new Date(task.deadline).toLocaleDateString('ru-RU')}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {task.subtasks.map(subtask => (
                    <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => toggleSubtask(task.id, subtask.id, subtask.completed)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `1px solid ${subtask.completed ? 'var(--green)' : 'var(--border)'}`,
                          background: subtask.completed ? 'var(--green)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {subtask.completed && <Check size={11} color="#fff" />}
                      </button>
                      <span className="caption" style={{ flex: 1, textDecoration: subtask.completed ? 'line-through' : 'none' }}>
                        {subtask.title}
                      </span>
                      <button onClick={() => deleteSubtask(task.id, subtask.id)} className="btn-icon btn-ghost">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input"
                      placeholder="Добавить подзадачу"
                      value={subtaskInputs[task.id] ?? ''}
                      onChange={e => setSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                    />
                    <button className="btn btn-ghost" onClick={() => addSubtask(task.id)}>+</button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteTask(task.id)}
                className="btn-icon btn-ghost"
                style={{ color: 'var(--red)', flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {archivedTasks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 className="title-sm" style={{ marginBottom: 8 }}>Архив</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivedTasks.map(task => (
              <div key={task.id} className="card" style={{ padding: '10px 12px', opacity: 0.75 }}>
                <div className="body-sm" style={{ textDecoration: 'line-through' }}>{task.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
            >
              <div className="modal-handle" />
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h2 className="title-sm">Новая задача</h2>
                <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label text-faint mb-2">Название *</div>
                <input
                  className="input"
                  placeholder="Что нужно сделать?"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label text-faint mb-2">Описание (необязательно)</div>
                <textarea
                  className="input"
                  placeholder="Дополнительные детали..."
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label text-faint mb-2">Дедлайн (необязательно)</div>
                <input
                  type="date"
                  className="input"
                  value={newTaskDeadline}
                  onChange={e => setNewTaskDeadline(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={addTask}
                disabled={!newTaskTitle.trim()}
              >
                Создать
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HabitsTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDesc, setNewHabitDesc] = useState('');
  const [newHabitDeadline, setNewHabitDeadline] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);

  const DAY_LABELS: Record<string, string> = {
    mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс',
  };

  useEffect(() => {
    loadHabits();
  }, []);

  async function loadHabits() {
    try {
      const { data } = await habitsApi.list();
      setHabits(data);
    } finally {
      setLoading(false);
    }
  }

  async function addHabit() {
    if (!newHabitTitle.trim()) return;
    try {
      const { data } = await habitsApi.create({ 
        title: newHabitTitle, 
        description: newHabitDesc,
        targetDays: selectedDays,
        deadline: newHabitDeadline ? new Date(newHabitDeadline).toISOString() : undefined,
      });
      setHabits([data, ...habits]);
      setNewHabitTitle('');
      setNewHabitDesc('');
      setNewHabitDeadline('');
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add habit:', err);
    }
  }

  async function toggleHabit(id: number) {
    try {
      const { data } = await habitsApi.toggle(id);
      setHabits(habits.map(h => h.id === id ? { ...h, completedToday: data.completed } : h));
    } catch (err) {
      console.error('Failed to toggle habit:', err);
    }
  }

  async function deleteHabit(id: number) {
    try {
      await habitsApi.delete(id);
      setHabits(habits.filter(h => h.id !== id));
    } catch (err) {
      console.error('Failed to delete habit:', err);
    }
  }

  function toggleDay(day: string) {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  if (loading) return <HabitsSkeleton />;

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => setShowAddModal(true)}
        className="btn btn-primary btn-full"
        style={{ marginBottom: 16 }}
      >
        <Plus size={16} />
        Добавить привычку
      </button>

      {habits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Repeat size={28} color="var(--text-3)" /></div>
          <div>
            <h3 className="title-sm">Нет привычек</h3>
            <p className="body-sm text-faint mt-1">Добавь первую привычку для отслеживания</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {habits.map((habit, i) => (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{ padding: '12px 14px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button
                  onClick={() => toggleHabit(habit.id)}
                  style={{
                    width: 28, height: 28,
                    borderRadius: 8,
                    border: `2px solid ${habit.completedToday ? 'var(--green)' : 'var(--border)'}`,
                    background: habit.completedToday ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {habit.completedToday && <Check size={16} color="#fff" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-sm" style={{ fontWeight: 500 }}>{habit.title}</div>
                  {habit.description && (
                    <div className="caption text-faint mt-1">{habit.description}</div>
                  )}
                  {habit.deadline && (
                    <div className="caption text-faint mt-1">
                      Дедлайн: {new Date(habit.deadline).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="btn-icon btn-ghost"
                  style={{ color: 'var(--red)', flexShrink: 0 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex gap-1" style={{ marginLeft: 40 }}>
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => (
                  <div
                    key={day}
                    style={{
                      width: 28, height: 28,
                      borderRadius: 6,
                      background: habit.targetDays.includes(day) ? 'var(--accent)' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11,
                      color: habit.targetDays.includes(day) ? '#fff' : 'var(--text-3)',
                    }}
                  >
                    {DAY_LABELS[day]}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
            >
              <div className="modal-handle" />
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h2 className="title-sm">Новая привычка</h2>
                <button className="btn-icon btn-ghost" onClick={() => setShowAddModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label text-faint mb-2">Название *</div>
                <input
                  className="input"
                  placeholder="Какую привычку хочешь развить?"
                  value={newHabitTitle}
                  onChange={e => setNewHabitTitle(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label text-faint mb-2">Описание (необязательно)</div>
                <textarea
                  className="input"
                  placeholder="Дополнительные детали..."
                  value={newHabitDesc}
                  onChange={e => setNewHabitDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label text-faint mb-2">Дедлайн (необязательно)</div>
                <input
                  type="date"
                  className="input"
                  value={newHabitDeadline}
                  onChange={e => setNewHabitDeadline(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label text-faint mb-2">Дни недели</div>
                <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      style={{
                        width: 36, height: 36,
                        borderRadius: 8,
                        background: selectedDays.includes(day) ? 'var(--accent)' : 'var(--surface-2)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: selectedDays.includes(day) ? '#fff' : 'var(--text-3)',
                      }}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={addHabit}
                disabled={!newHabitTitle.trim() || selectedDays.length === 0}
              >
                Создать
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div style={{ padding: '0 16px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 60, marginBottom: 8 }} />
      ))}
    </div>
  );
}

function HabitsSkeleton() {
  return (
    <div style={{ padding: '0 16px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 80, marginBottom: 8 }} />
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
      <div className="empty-icon">
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
