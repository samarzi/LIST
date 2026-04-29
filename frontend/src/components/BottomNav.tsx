import { motion } from 'framer-motion';
import { Target, Eye, Trophy, Zap, Vote } from 'lucide-react';
import { useUIStore } from '../store';

const tabs = [
  { id: 'path',        label: 'Путь',        icon: Target },
  { id: 'helper',      label: 'Хелпер',      icon: Eye },
  { id: 'voting',      label: 'Голосование', icon: Vote },
  { id: 'leaderboard', label: 'Рейтинг',     icon: Trophy },
  { id: 'profile',     label: 'Профиль',     icon: Zap },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useUIStore();

  const handleTab = (id: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback && Number(tg.version) >= 6.1) {
      tg.HapticFeedback.selectionChanged();
    }
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
        background: 'rgba(10, 10, 14, 0.92)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -1px 0 rgba(99,102,241,0.08), 0 -8px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        paddingTop: 8,
        paddingBottom: 4,
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
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 2px',
              borderRadius: 12,
              outline: 'none',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              minWidth: 0,
            }}
          >
            {active && (
              <motion.div
                layoutId="nav-pill"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  marginLeft: -19,
                  width: 38,
                  height: 30,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(10,132,255,0.18) 100%)',
                  borderRadius: 10,
                  zIndex: 0,
                  boxShadow: '0 0 12px rgba(99,102,241,0.3)',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <motion.div
              animate={{ scale: active ? 1.08 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.3 : 1.7}
                color={active ? '#a5b4fc' : 'rgba(255,255,255,0.32)'}
              />
            </motion.div>
            <span
              style={{
                fontSize: 9,
                fontWeight: active ? 700 : 400,
                color: active ? '#a5b4fc' : 'rgba(255,255,255,0.32)',
                letterSpacing: active ? 0.1 : 0,
                transition: 'color 0.2s',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
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
