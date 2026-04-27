import { motion } from 'framer-motion';
import { Target, Eye, Trophy, Coins, BookOpen } from 'lucide-react';
import { useUIStore } from '../store';

const tabs = [
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'watch', label: 'Слежу', icon: Eye },
  { id: 'leaderboard', label: 'Рейтинг', icon: Trophy },
  { id: 'lit', label: 'LIT', icon: Coins },
  { id: 'teachers', label: 'Учителя', icon: BookOpen },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();

  const handleTab = (id: string) => {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    setActiveTab(id);
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 540,
        height: 'var(--nav-h)',
        background: 'rgba(12, 12, 15, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        paddingTop: 8,
        paddingBottom: 8,
        zIndex: 50,
      }}
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => handleTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 4px',
              borderRadius: 12,
              outline: 'none',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {active && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 40,
                  height: 32,
                  background: 'rgba(99, 102, 241, 0.15)',
                  borderRadius: 10,
                  zIndex: 0,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <motion.div
              animate={{ scale: active ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? '#818cf8' : 'rgba(255,255,255,0.4)'}
              />
            </motion.div>
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active ? '#818cf8' : 'rgba(255,255,255,0.4)',
                letterSpacing: active ? 0.2 : 0,
                transition: 'color 0.2s, font-weight 0.2s',
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
