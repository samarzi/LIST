import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Plus, X, User, Users, Briefcase, Filter, Info } from 'lucide-react';
import { listingsApi, type Listing } from '../api/client';

const CATEGORIES = [
  { id: 'all', label: 'Все', icon: Filter },
  { id: 'teacher', label: 'Учителя', icon: Briefcase },
  { id: 'student', label: 'Ученики', icon: User },
  { id: 'team', label: 'Команды', icon: Users },
];

export default function SearchPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'teacher' as 'teacher' | 'student' | 'team',
    title: '',
    description: '',
    skills: [] as string[],
  });
  const [skillInput, setSkillInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    loadListings();
    loadMyListings();
  }, [activeCategory]);

  async function loadListings() {
    setLoading(true);
    try {
      const { data } = await listingsApi.list(activeCategory === 'all' ? undefined : activeCategory);
      setListings(data.listings);
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyListings() {
    try {
      const { data } = await listingsApi.my();
      setMyListings(data.listings);
    } catch (err) {
      console.error('Failed to load my listings:', err);
    }
  }

  async function handleCreate() {
    if (!formData.title.trim()) return;
    
    try {
      await listingsApi.create(formData);
      setShowCreateModal(false);
      setFormData({ type: 'teacher', title: '', description: '', skills: [] });
      loadListings();
      loadMyListings();
    } catch (err) {
      console.error('Failed to create listing:', err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await listingsApi.delete(id);
      loadListings();
      loadMyListings();
    } catch (err) {
      console.error('Failed to delete listing:', err);
    }
  }

  function addSkill() {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  }

  function removeSkill(skill: string) {
    setFormData({ ...formData, skills: formData.skills.filter((s: string) => s !== skill) });
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="title-lg text-gradient">Поиск</h1>
          <p className="body-sm text-faint mt-1">Найди учителя, ученика или команду</p>
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

      {/* Categories */}
      <div className="flex gap-2" style={{ marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: 16, WebkitOverflowScrolling: 'touch' }}>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 20,
                border: 'none',
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                color: active ? '#fff' : 'var(--text-2)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <Icon size={14} />
              {cat.label}
            </motion.button>
          );
        })}
        <div style={{ flexShrink: 0, width: 16 }} />
      </div>

      {/* My Listings */}
      {myListings.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <div className="label text-faint mb-3">Мои объявления</div>
          {myListings.map(listing => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
              style={{ padding: 14, marginBottom: 8, position: 'relative' }}
            >
              <button
                onClick={() => handleDelete(listing.id)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-3)',
                }}
              >
                <X size={16} />
              </button>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, paddingRight: 24 }}>
                {listing.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                {listing.description}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {listing.skills.map(skill => (
                  <span
                    key={skill}
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      background: 'var(--surface-2)',
                      borderRadius: 10,
                      color: 'var(--text-2)',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Listings */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div className="flex-col gap-2 flex">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><SearchIcon size={28} color="var(--text-3)" /></div>
            <div>
              <h3 className="title-sm">Нет объявлений</h3>
              <p className="body-sm text-faint mt-2">Будь первым — создай объявление</p>
            </div>
          </div>
        ) : (
          listings.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))
        )}
      </div>

      {/* Create FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowCreateModal(true)}
        style={{
          position: 'fixed',
          bottom: 90,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'var(--accent)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          zIndex: 40,
        }}
      >
        <Plus size={24} color="#fff" />
      </motion.button>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
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
            onClick={() => setShowCreateModal(false)}
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
                maxWidth: 400,
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 className="title-lg">Новое объявление</h2>
                <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="var(--text-2)" />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['teacher', 'student', 'team'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, type })}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 10,
                      border: 'none',
                      background: formData.type === type ? 'var(--accent)' : 'var(--surface-2)',
                      color: formData.type === type ? '#fff' : 'var(--text-2)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {type === 'teacher' ? 'Учитель' : type === 'student' ? 'Ученик' : 'Команда'}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label text-faint mb-2">Заголовок</label>
                <input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Что ты ищешь?"
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label text-faint mb-2">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Подробнее о твоем запросе..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: 14,
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label text-faint mb-2">Навыки</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    placeholder="Добавить навык"
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  />
                  <button onClick={addSkill} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    Добавить
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {formData.skills.map(skill => (
                    <span
                      key={skill}
                      style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        background: 'var(--surface-2)',
                        borderRadius: 12,
                        color: 'var(--text-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {skill}
                      <button onClick={() => removeSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!formData.title.trim()}
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: formData.title.trim() ? 'pointer' : 'not-allowed',
                  opacity: formData.title.trim() ? 1 : 0.5,
                }}
              >
                Опубликовать
              </button>
            </motion.div>
          </motion.div>
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
                <h2 className="title-lg">О разделе Поиск</h2>
                <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="var(--text-2)" />
                </button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Учителя:</strong> Найди наставника, который поможет тебе развиваться в нужном направлении.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Ученики:</strong> Найди людей, которым ты можешь передать свои знания и опыт.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Команды:</strong> Собери команду единомышленников для совместных проектов.
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  Создавай объявления, указывай свои навыки и цели — так тебя будет проще найти!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const typeLabels = { teacher: 'Учитель', student: 'Ученик', team: 'Команда' };
  const typeColors = { teacher: '#10b981', student: '#6366f1', team: '#f59e0b' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{ padding: 14, marginBottom: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: typeColors[listing.type as keyof typeof typeColors] + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {listing.type === 'teacher' && <Briefcase size={20} color={typeColors.teacher} />}
          {listing.type === 'student' && <User size={20} color={typeColors.student} />}
          {listing.type === 'team' && <Users size={20} color={typeColors.team} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: typeColors[listing.type as keyof typeof typeColors] + '20',
                color: typeColors[listing.type as keyof typeof typeColors],
                fontWeight: 600,
              }}
            >
              {typeLabels[listing.type as keyof typeof typeLabels]}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{listing.title}</span>
          </div>

          {listing.description && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.4 }}>
              {listing.description}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {listing.skills.map((skill: string) => (
              <span
                key={skill}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                  color: 'var(--text-2)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #0A84FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {listing.user.displayName?.slice(0, 2).toUpperCase() || listing.user.username?.slice(0, 2).toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {listing.user.displayName || listing.user.username || 'Пользователь'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
            Lvl {listing.user.level} • {listing.user.rating.toFixed(1)} ★
          </div>
        </div>
      </div>
    </motion.div>
  );
}
