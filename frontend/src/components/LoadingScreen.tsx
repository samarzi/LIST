import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        zIndex: 999,
      }}
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #6366f1 0%, #0A84FF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 60px rgba(99, 102, 241, 0.4)',
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>L</span>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: '#fff' }}>LIST</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Цели. Партнёры. Результаты.</div>
      </motion.div>

      {/* Spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Spinner />
      </motion.div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <motion.circle
        cx="16" cy="16" r="13"
        stroke="url(#spin-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="60 20"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ originX: '50%', originY: '50%' }}
      />
      <defs>
        <linearGradient id="spin-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#0A84FF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
