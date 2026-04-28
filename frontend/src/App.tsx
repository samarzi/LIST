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
import SearchPage from './pages/Search';
import VotingPage from './pages/Voting';

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
  path: GoalsPage,
  helper: WatchPage,
  leaderboard: LeaderboardPage,
  teachers: SearchPage,
  profile: LITPage,
  voting: VotingPage,
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
    const onUnauthorized = () => {
      setAuthState('error');
      setErrorMsg('Сессия истекла. Войдите заново через Telegram');
    };
    window.addEventListener('list:unauthorized', onUnauthorized);
    // Определяем тип устройства
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => {
      window.removeEventListener('resize', checkDesktop);
      window.removeEventListener('list:unauthorized', onUnauthorized);
    };
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
    const isLocalWeb = ['localhost', '127.0.0.1', 'stellular-haupia-9bddae.netlify.app'].includes(window.location.hostname);

    let initData = tg?.initData ?? '';

    console.log('Auth attempt:', {
      hasTg: !!tg,
      hasInitData: !!initData,
      initDataLength: initData.length,
      initDataPreview: initData.substring(0, 100),
    });

    // Dev mode fallback — use test: format to authenticate with backend
    if (!initData && (import.meta.env.DEV || isLocalWeb)) {
      const devUser = {
        id: 999999999, // Fixed telegramId for dev mode
        username: 'devuser',
        first_name: 'Dev',
        last_name: 'User',
      };
      initData = `test:${JSON.stringify(devUser)}`;
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
    const isLocalWeb = ['localhost', '127.0.0.1', 'stellular-haupia-9bddae.netlify.app'].includes(window.location.hostname);
    let initData = tg?.initData ?? '';

    if (!initData && (import.meta.env.DEV || isLocalWeb)) {
      const devUser = {
        id: 999999999, // Fixed telegramId for dev mode
        username: 'devuser',
        first_name: 'Dev',
        last_name: 'User',
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
      setAuthState('authed');
    } catch {
      // If refresh fails, keep cached session only when a token exists.
      // Otherwise force explicit re-login to avoid endless 401 loops.
      if (useAuthStore.getState().token) {
        setAuthState('authed');
      } else {
        logout();
        setAuthState('error');
        setErrorMsg('Сессия истекла. Войдите заново через Telegram');
      }
    }
  }

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  if (authState === 'error') {
    return <DevLoginScreen message={errorMsg} onRetry={() => { setAuthState('loading'); freshLogin(); }} />;
  }

  const ActivePage = PAGES[activeTab] ?? GoalsPage;

  return (
    <div className={`app-shell ${isDesktop ? 'desktop-nav' : ''}`}>
      {/* Subtle grid background */}
      <div className="grid-bg" />

      {/* Desktop Navigation */}
      {isDesktop && <SideNav />}

      {/* Page content with animated transitions */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="sync">
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

function DevLoginScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [showDevMode, setShowDevMode] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { setAuth } = useAuthStore();

  const handleDevLogin = async () => {
    if (password === '8985') {
      try {
        // Вход как реальный пользователь @t0g0r0t
        const realUser = {
          id: 1346574159,
          username: 't0g0r0t',
          first_name: 'sаmarzi',
          last_name: '',
        };
        const initData = `test:dev:${JSON.stringify(realUser)}`;
        const { data } = await authApi.loginTelegram(initData);
        console.log('Dev mode auth success:', data.user);
        setAuth(data.token, data.user);
      } catch (err: any) {
        console.error('Dev mode auth failed:', err);
        setPasswordError(`Ошибка входа: ${err.response?.data?.error || err.message || 'Неизвестная ошибка'}`);
        setTimeout(() => setPasswordError(''), 3000);
      }
    } else {
      setPasswordError('Неверный пароль');
      setTimeout(() => setPasswordError(''), 2000);
    }
  };

  const openTelegram = () => {
    // Попытка открыть приложение в Telegram
    const tgBotUsername = 't0g0r0t'; // Замените на ваш юзернейм бота
    const webAppUrl = window.location.href;
    window.open(`https://t.me/${tgBotUsername}?startapp=${encodeURIComponent(webAppUrl)}`, '_blank');
  };

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

      {!showDevMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="btn btn-primary"
            onClick={() => setShowDevMode(true)}
          >
            🔧 Режим разработчика
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="btn btn-secondary"
            onClick={openTelegram}
          >
            📱 Войти через Telegram
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            className="btn btn-ghost"
            onClick={onRetry}
          >
            Попробовать снова
          </motion.button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Режим разработчика</h3>
          
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleDevLogin()}
            className="input"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
              color: 'var(--text-1)',
              fontSize: 15,
            }}
          />
          
          {passwordError && (
            <div style={{ color: 'var(--red)', fontSize: 13 }}>{passwordError}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary"
              onClick={handleDevLogin}
              style={{ flex: 1 }}
            >
              Войти
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn btn-ghost"
              onClick={() => setShowDevMode(false)}
              style={{ flex: 1 }}
            >
              Отмена
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
