import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { authApi } from './api/client';
import { useAuthStore, useUIStore } from './store';
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
import LoadingScreen from './components/LoadingScreen';
import GoalsPage from './pages/Goals';
import WatchPage from './pages/Watch';
import LeaderboardPage from './pages/Leaderboard';
import LITPage from './pages/LIT';
import TeachersPage from './pages/Teachers';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            photo_url?: string;
          };
        };
        HapticFeedback?: {
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          selectionChanged: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        version: string;
        platform: string;
      };
    };
  }
}

const PAGES: Record<string, React.ComponentType> = {
  goals: GoalsPage,
  watch: WatchPage,
  leaderboard: LeaderboardPage,
  lit: LITPage,
  teachers: TeachersPage,
};

export default function App() {
  const { token, user, setAuth, logout } = useAuthStore();
  const { activeTab } = useUIStore();
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Инициализация Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      console.log('Telegram WebApp initialized:', {
        version: tg.version,
        platform: tg.platform,
        initData: tg.initData ? 'present' : 'missing',
        initDataUnsafe: tg.initDataUnsafe,
      });
    } else {
      console.warn('Telegram WebApp not available');
    }

    authenticate();
    // Определяем тип устройства
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  async function authenticate() {
    // Already have a valid token
    if (token && user) {
      // Re-verify with fresh Telegram data (to sync username)
      await refreshAuth();
      return;
    }
    await freshLogin();
  }

  async function freshLogin() {
    const tg = window.Telegram?.WebApp;

    let initData = tg?.initData ?? '';

    console.log('Auth attempt:', {
      hasTg: !!tg,
      hasInitData: !!initData,
      initDataLength: initData.length,
      initDataPreview: initData.substring(0, 100),
    });

    // Dev mode fallback — simulate a user
    if (!initData && import.meta.env.DEV) {
      const devUser = { id: 123456789, username: 'devuser', first_name: 'Dev', last_name: 'User' };
      initData = `test:${JSON.stringify(devUser)}`;
      console.log('Using dev mode fallback');
    }

    if (!initData) {
      setAuthState('error');
      setErrorMsg('Открой приложение через Telegram');
      return;
    }

    try {
      const { data } = await authApi.loginTelegram(initData);
      console.log('Auth success:', data.user);
      setAuth(data.token, data.user);
      setAuthState('authed');
    } catch (err: any) {
      console.error('Auth failed:', err);
      console.error('Error response:', err.response?.data);
      setAuthState('error');
      setErrorMsg(`Ошибка авторизации: ${err.response?.data?.error || err.message || 'Неизвестная ошибка'}`);
    }
  }

  async function refreshAuth() {
    const tg = window.Telegram?.WebApp;
    let initData = tg?.initData ?? '';

    if (!initData && import.meta.env.DEV && user) {
      const devUser = {
        id: user.telegramId,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
      };
      initData = `test:${JSON.stringify(devUser)}`;
    }

    if (!initData) {
      setAuthState('authed'); // use cached
      return;
    }

    try {
      const { data } = await authApi.loginTelegram(initData);
      setAuth(data.token, data.user);
    } catch {
      // Token refresh failed but we have cached data, still show app
    } finally {
      setAuthState('authed');
    }
  }

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  if (authState === 'error') {
    return <ErrorScreen message={errorMsg} onRetry={() => { setAuthState('loading'); freshLogin(); }} />;
  }

  const ActivePage = PAGES[activeTab] ?? GoalsPage;

  return (
    <div className={`app-shell ${isDesktop ? 'desktop-nav' : ''}`}>
      {/* Subtle grid background */}
      <div className="grid-bg" />

      {/* Desktop Navigation */}
      {isDesktop && <SideNav />}

      {/* Page content with animated transitions */}
      <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            <ActivePage />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile Navigation */}
      {!isDesktop && <BottomNav />}
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 20,
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, #6366f1 0%, #0A84FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(99,102,241,0.3)',
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>L</span>
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>LIST</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 15 }}>{message}</p>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        className="btn btn-primary"
        onClick={onRetry}
      >
        Попробовать снова
      </motion.button>
    </motion.div>
  );
}
