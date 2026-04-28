import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Clock, TrendingUp, AlertCircle, X, ChevronRight, Flame,
  CheckCircle2, XCircle, FileText, Vote, RefreshCw, ExternalLink, User, MessageSquare, Info,
} from 'lucide-react';
import { pairsApi, goalsApi, votingApi, type WatcherStudent, type PairStatus } from '../api/client';
import { useUIStore } from '../store';

const DIFFICULTY_HINTS: Record<number, { label: string; color: string; desc: string }> = {
  0:  { label: 'Невалидная', color: 'var(--red)',    desc: 'Цель не имеет смысла или невыполнима' },
  1:  { label: 'Очень легко', color: 'var(--green)',  desc: '×1 LIT' },
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

type GoalWithProof = WatcherStudent['partner']['activeGoals'][0];

export default function WatchPage() {
  const { setActiveTab } = useUIStore();
  const [activeTab, setActiveTabState] = useState<'partner' | 'watcher'>('partner');
  const [pairStatus, setPairStatus] = useState<PairStatus | null>(null);
  const [students, setStudents] = useState<WatcherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [difficultyGoal, setDifficultyGoal] = useState<GoalWithProof | null>(null);
  const [proofGoal, setProofGoal] = useState<GoalWithProof | null>(null);
  const [showChangePair, setShowChangePair] = useState(false);
  const [pendingVotes, setPendingVotes] = useState(0);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const tabs = [
    { id: 'partner' as const, label: 'Партнер', icon: User },
    { id: 'watcher' as const, label: 'Смотрящий', icon: MessageSquare },
  ];

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeTab === 'watcher' && pairStatus?.asPartner) {
      loadMessages();
    }
  }, [activeTab, pairStatus]);

  async function load() {
    setLoading(true);
    try {
      const [pair, studs, voteResp] = await Promise.all([
        pairsApi.current(),
        pairsApi.myPartners(),
        votingApi.next(),
      ]);
      setPairStatus(pair.data);
      setStudents(studs.data);
      setPendingVotes(voteResp.data.session ? 1 : 0);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    try {
      const { data } = await pairMessagesApi.list();
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const { data } = await pairMessagesApi.create({ content: newMessage.trim() });
      setMessages([...messages, data]);
      setNewMessage('');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
      console.error('Failed to send message:', err);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleJoinQueue() {
    setJoiningQueue(true);
    try {
      console.log('Joining queue...');
      const { data } = await pairsApi.joinQueue();
      console.log('Join queue response:', data);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      const pair = await pairsApi.current();
      setPairStatus(pair.data);
    } catch (err) {
      console.error('Failed to join queue:', err);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setJoiningQueue(false);
    }
  }

  async function handleLeaveQueue() {
    try {
      await pairsApi.leaveQueue();
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      const pair = await pairsApi.current();
      setPairStatus(pair.data);
    } catch (err) {
      console.error('Failed to leave queue:', err);
    }
  }

  const reviewGoals = students.flatMap(ws =>
    ws.partner.activeGoals.filter(g => g.status === 'on_review')
  );
  const proofGoals = students.flatMap(ws =>
    ws.partner.activeGoals.filter(g => g.status === 'on_check')
  );

  async function handleDifficultySet(goalId: number, difficulty: number) {
    await goalsApi.setDifficulty(goalId, difficulty);
    setDifficultyGoal(null);
    const { data } = await pairsApi.myPartners();
    setStudents(data);
  }

  async function handleProofDecision(goalId: number, confirmed: boolean, note?: string) {
    await goalsApi.confirmProof(goalId, confirmed, note);
    setProofGoal(null);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    const { data } = await pairsApi.myPartners();
    setStudents(data);
  }

  async function handleChangePair(reason: string) {
    await pairsApi.changePair(reason);
    setShowChangePair(false);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    const { data } = await pairsApi.current();
    setPairStatus(data);
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ padding: '24px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="title-lg text-gradient">Хелпер</h1>
          <p className="body-sm text-faint mt-2">Партнёры и смотрящие</p>
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
                onClick={() => setActiveTabState(tab.id)}
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
        {activeTab === 'partner' && (
          <>
            {/* Voting banner */}
            <AnimatePresence>
              {pendingVotes > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{ margin: '0 16px 12px' }}
                >
                  <button
                    onClick={() => setActiveTab('voting')}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 14px',
                      background: 'rgba(167,139,250,0.08)',
                      border: '1px solid rgba(167,139,250,0.25)',
                      borderRadius: 14,
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <Vote size={18} color="#a78bfa" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>Есть цели на голосование</div>
                      <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.6)', marginTop: 2 }}>Оцени и получи +2 LIT</div>
                    </div>
                    <ChevronRight size={15} color="#a78bfa" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Proof review alert */}
            <AnimatePresence>
              {proofGoals.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{ margin: '0 16px 12px' }}
                >
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(48,209,88,0.06)',
                      border: '1px solid rgba(48,209,88,0.2)',
                      borderRadius: 14,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <FileText size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 2 }}>
                        Доказательства ждут проверки
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(48,209,88,0.6)', lineHeight: 1.4 }}>
                        {proofGoals.length} {proofGoals.length === 1 ? 'доказательство' : 'доказательства'} — нажми на карточку цели
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <AlertCircle size={18} color="var(--yellow)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)', marginBottom: 2 }}>
                        Нужна оценка сложности
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,214,10,0.7)', lineHeight: 1.4 }}>
                        {reviewGoals.length} {reviewGoals.length === 1 ? 'цель ждёт' : 'цели ждут'} — нажми на карточку
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* My students list */}
            {students.length === 0 ? (
              <div style={{ padding: '0 16px' }}>
                <div className="empty-state">
                  <div className="empty-icon"><User size={28} color="var(--text-3)" /></div>
                  <div>
                    <h3 className="title-sm">Нет партнёров</h3>
                    <p className="body-sm text-faint mt-1">Найди партнёра чтобы следить за его прогрессом</p>
                    <button
                      onClick={handleJoinQueue}
                      disabled={joiningQueue}
                      style={{
                        marginTop: 16,
                        padding: '10px 20px',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: joiningQueue ? 'not-allowed' : 'pointer',
                        opacity: joiningQueue ? 0.6 : 1,
                      }}
                    >
                      {joiningQueue ? 'Поиск...' : 'Найти партнёра'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                {students.map((ws, i) => (
                  <StudentCard
                    key={ws.partner.id}
                    ws={ws}
                    index={i}
                    onReviewClick={setDifficultyGoal}
                    onProofClick={setProofGoal}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'watcher' && (
          <>
            {/* My watcher */}
            {pairStatus?.asPartner ? (
              <div style={{ padding: '0 16px' }}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card card-border-gradient"
                  style={{ padding: '14px 16px' }}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={pairStatus.asPartner!.watcher} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title-sm truncate">
                        {pairStatus.asPartner!.watcher.displayName ?? pairStatus.asPartner!.watcher.username ?? 'Смотрящий'}
                      </div>
                      {pairStatus.asPartner!.watcher.username && (
                        <div className="body-sm text-faint mt-1">@{pairStatus.asPartner!.watcher.username}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span className="badge badge-green">Активен</span>
                      <button
                        onClick={() => setShowChangePair(true)}
                        style={{
                          fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none',
                          cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <RefreshCw size={11} />
                        Сменить
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Questions/Improvements section */}
                <div style={{ marginTop: 16 }}>
                  <div className="label text-faint mb-3">Доработки и вопросы</div>
                  
                  {/* Messages list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {messages.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon"><MessageSquare size={28} color="var(--text-3)" /></div>
                        <div>
                          <h3 className="title-sm">Нет сообщений</h3>
                          <p className="body-sm text-faint mt-1">Здесь будут появляться доработки и вопросы от смотрящего</p>
                        </div>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            padding: '12px 14px',
                            background: msg.isFromMe ? 'var(--surface-2)' : 'rgba(167,139,250,0.06)',
                            border: msg.isFromMe ? '1px solid transparent' : '1px solid rgba(167,139,250,0.15)',
                            borderRadius: 12,
                            alignSelf: msg.isFromMe ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                          }}
                        >
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
                            {msg.isFromMe ? 'Вы' : (msg.sender.displayName || msg.sender.username || 'Смотрящий')}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--text-1)' }}>
                            {msg.content}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                            {new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Send message input */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Написать сообщение..."
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                      style={{ flex: 1, fontSize: 14 }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: newMessage.trim() ? 'var(--accent)' : 'var(--surface-2)',
                        border: 'none',
                        cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: sendingMessage ? 0.6 : 1,
                      }}
                    >
                      <Send size={18} color={newMessage.trim() ? '#fff' : 'var(--text-3)'} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                <div className="empty-state">
                  <div className="empty-icon"><MessageSquare size={28} color="var(--text-3)" /></div>
                  <div>
                    <h3 className="title-sm">Нет смотрящего</h3>
                    <p className="body-sm text-faint mt-1">Найди смотрящего чтобы получить помощь и поддержку</p>
                    <button
                      onClick={handleJoinQueue}
                      disabled={joiningQueue}
                      style={{
                        marginTop: 16,
                        padding: '10px 20px',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: joiningQueue ? 'not-allowed' : 'pointer',
                        opacity: joiningQueue ? 0.6 : 1,
                      }}
                    >
                      {joiningQueue ? 'Поиск...' : 'Найти смотрящего'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

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

      {/* Proof confirm modal */}
      <AnimatePresence>
        {proofGoal && (
          <ProofConfirmModal
            goal={proofGoal}
            onClose={() => setProofGoal(null)}
            onDecide={(confirmed, note) => handleProofDecision(proofGoal.id, confirmed, note)}
          />
        )}
      </AnimatePresence>

      {/* Change pair modal */}
      <AnimatePresence>
        {showChangePair && (
          <ChangePairModal
            onClose={() => setShowChangePair(false)}
            onConfirm={handleChangePair}
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
                <h2 className="title-lg">О разделе Хелпер</h2>
                <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="var(--text-2)" />
                </button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Партнер:</strong> Твой партнер — это человек, чьи цели ты проверяешь. Оцени сложность и подтверждай доказательства.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Смотрящий:</strong> Твой смотрящий проверяет твои цели и помогает тебе расти.
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  Система матчинга автоматически подбирает партнеров и смотрящих на основе твоего уровня.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentCard({
  ws,
  index,
  onReviewClick,
  onProofClick,
}: {
  ws: WatcherStudent;
  index: number;
  onReviewClick: (goal: GoalWithProof) => void;
  onProofClick: (goal: GoalWithProof) => void;
}) {
  const { partner } = ws;
  const name = partner.displayName ?? partner.username ?? 'Партнёр';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="card"
      style={{ marginBottom: 12 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar user={partner} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title-sm truncate">{name}</div>
          {partner.username && <div className="body-sm text-faint mt-1">@{partner.username}</div>}
        </div>
        <div className="badge badge-ghost" style={{ flexShrink: 0 }}>Lvl {partner.level}</div>
      </div>

      {partner.activeGoals.length === 0 ? (
        <div className="body-sm text-faint text-center" style={{ padding: '8px 0' }}>
          Нет активных целей
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {partner.activeGoals.map(goal => {
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000);
            const needsReview = goal.status === 'on_review';
            const needsProof = goal.status === 'on_check';

            return (
              <motion.div
                key={goal.id}
                whileTap={(needsReview || needsProof) ? { scale: 0.98 } : undefined}
                onClick={() => {
                  if (needsReview) onReviewClick(goal);
                  else if (needsProof) onProofClick(goal);
                }}
                style={{
                  padding: '10px 12px',
                  background: needsProof
                    ? 'rgba(48,209,88,0.06)'
                    : needsReview
                    ? 'rgba(255,214,10,0.06)'
                    : 'var(--surface-2)',
                  border: `1px solid ${needsProof ? 'rgba(48,209,88,0.2)' : needsReview ? 'rgba(255,214,10,0.2)' : 'transparent'}`,
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: (needsReview || needsProof) ? 'pointer' : 'default',
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
                {needsProof ? (
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Проверить</span>
                    <ChevronRight size={13} color="var(--green)" />
                  </div>
                ) : needsReview ? (
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

function ProofConfirmModal({
  goal,
  onClose,
  onDecide,
}: {
  goal: GoalWithProof;
  onClose: () => void;
  onDecide: (confirmed: boolean, note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'view' | 'reject'>('view');

  async function decide(confirmed: boolean) {
    setLoading(true);
    try {
      await onDecide(confirmed, note || undefined);
    } finally {
      setLoading(false);
    }
  }

  const proof = goal.latestProof;

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
            <h2 className="title-md">Проверка доказательства</h2>
            <p className="body-sm text-faint mt-1">Подтверди или отклони результат</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Goal info */}
        <div
          style={{
            padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16,
          }}
        >
          <div className="label text-faint mb-1">Цель</div>
          <p className="body-sm" style={{ fontWeight: 500 }}>{goal.title}</p>
          {goal.successCriteria && (
            <>
              <div className="label text-faint mt-2 mb-1">Критерии успеха</div>
              <p className="body-sm text-muted" style={{ lineHeight: 1.4 }}>{goal.successCriteria}</p>
            </>
          )}
        </div>

        {/* Proof */}
        {proof ? (
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(48,209,88,0.06)',
              border: '1px solid rgba(48,209,88,0.15)',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div className="label text-faint mb-2">Доказательство</div>
            <p className="body-sm" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{proof.description}</p>
            {proof.mediaUrls?.length > 0 && (
              <div className="flex gap-2 mt-3" style={{ flexWrap: 'wrap' }}>
                {proof.mediaUrls.map((url, i) => (
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
                    Файл {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '12px 14px', background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)',
              borderRadius: 12, marginBottom: 16, fontSize: 13, color: 'var(--red)',
            }}
          >
            ⚠ Доказательство не предоставлено
          </div>
        )}

        {step === 'reject' && (
          <div style={{ marginBottom: 16 }}>
            <div className="label text-faint mb-2">Комментарий (необязательно)</div>
            <textarea
              className="input"
              placeholder="Что нужно доработать?"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {step === 'view' ? (
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              style={{ flex: 1, color: 'var(--red)', borderColor: 'rgba(255,69,58,0.3)' }}
              onClick={() => setStep('reject')}
              disabled={loading}
            >
              <XCircle size={16} />
              Отклонить
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, background: 'linear-gradient(135deg, #30d158, #34c759)' }}
              onClick={() => decide(true)}
              disabled={loading}
            >
              <CheckCircle2 size={16} />
              {loading ? 'Отправляю...' : 'Подтвердить'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-ghost" style={{ flex: 0.4 }} onClick={() => setStep('view')} disabled={loading}>
              Назад
            </button>
            <button
              className="btn"
              style={{ flex: 1, background: 'rgba(255,69,58,0.12)', color: 'var(--red)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 12 }}
              onClick={() => decide(false)}
              disabled={loading}
            >
              {loading ? 'Отправляю...' : 'Отклонить'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ChangePairModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!reason.trim()) { setErr('Укажи причину'); return; }
    setLoading(true);
    setErr('');
    try {
      await onConfirm(reason);
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
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      >
        <div className="modal-handle" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="title-md">Сменить смотрящего</h2>
            <p className="body-sm text-faint mt-1">Можно раз в 2 недели</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div
          style={{
            padding: '12px 14px', background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.2)',
            borderRadius: 12, marginBottom: 16, fontSize: 13, color: 'var(--orange)', lineHeight: 1.5,
          }}
        >
          ⚠ После смены текущий смотрящий будет удалён и начнётся поиск нового. Активные цели сохранятся.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="label text-faint mb-2">Причина *</div>
          <textarea
            className="input"
            placeholder="Почему хочешь сменить смотрящего?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {err && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{err}</div>}

        <div className="flex gap-2">
          <button className="btn btn-ghost" style={{ flex: 0.4 }} onClick={onClose} disabled={loading}>Отмена</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? 'Отправляю...' : 'Сменить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoalStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    in_progress: 'var(--accent)',
    on_check:    'var(--green)',
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
  goal: GoalWithProof;
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

        <div
          style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 12, marginBottom: 20 }}
        >
          <div className="label text-faint mb-1">Цель</div>
          <p className="body-sm" style={{ fontWeight: 500 }}>{goal.title}</p>
        </div>

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
            type="range" min={0} max={10} step={1}
            value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
          />
          <div className="flex justify-between mt-1">
            <span className="caption text-faint">0 — Невалид</span>
            <span className="caption text-faint">5 — Средне</span>
            <span className="caption text-faint">10 — Легенда</span>
          </div>
        </div>

        <AnimatePresence>
          {difficulty === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '10px 12px', background: 'rgba(255,69,58,0.08)',
                border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, marginBottom: 16,
                fontSize: 12, color: 'var(--red)', lineHeight: 1.5,
              }}
            >
              ⚠ Оценка 0 вернёт цель ученику на доработку. Используй только если цель невыполнима.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 0.4 }}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
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
        src={user.photoUrl} alt={name}
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
    <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="empty-icon"><Eye size={28} color="var(--text-3)" /></div>
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
