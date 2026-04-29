import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { useAuthStore } from '../store';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="page-content">
      {/* Header with info button */}
      <div style={{ padding: '24px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="title-lg text-gradient">Профиль</h1>
          <p className="body-sm text-faint mt-1">Твои достижения и настройки</p>
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

      {/* Profile Card */}
      {user && <ProfileCard user={user} />}

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
              background: 'rgba(5,5,8,0.75)',
              backdropFilter: 'blur(28px) saturate(140%)',
              WebkitBackdropFilter: 'blur(28px) saturate(140%)',
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
                background: 'rgba(22, 22, 32, 0.92)',
                backdropFilter: 'blur(40px) saturate(160%)',
                WebkitBackdropFilter: 'blur(40px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 20,
                padding: 24,
                width: '100%',
                maxWidth: 380,
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="title-lg">О разделе Профиль</h2>
                <button onClick={() => setShowInfo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={24} color="var(--text-2)" />
                </button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Профиль:</strong> Здесь отображается вся информация о тебе — уровень, рейтинг, баланс LIT и статистика.
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Уровень:</strong> Отражает твой прогресс в системе. Повышай уровень, выполняя цели.
                </p>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  Твой профиль — это визитная карточка в сообществе!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
