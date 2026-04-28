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
        gap: 32,
        zIndex: 999,
        overflow: 'hidden',
      }}
    >
      {/* Animated background with multiple gradients */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <motion.div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 30% 50%, rgba(99,102,241,0.08) 0%, transparent 50%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 70% 50%, rgba(139,92,246,0.08) 0%, transparent 50%)',
          }}
          animate={{
            scale: [1.3, 1, 1.3],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Logo animation */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <motion.div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #0A84FF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <motion.div
            animate={{ rotate: [0, -360] }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>L</span>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{ textAlign: 'center', zIndex: 1 }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: -1,
            background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          LIST
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, fontWeight: 500 }}>
          Цели. Партнёры. Результаты.
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 200, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        style={{
          height: 3,
          background: 'var(--surface-3)',
          borderRadius: 2,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #0A84FF)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            width: ['0%', '70%', '90%'],
            backgroundPosition: ['0% 0%', '100% 0%'],
          }}
          transition={{
            width: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
            backgroundPosition: { duration: 2, repeat: Infinity, ease: 'linear' },
          }}
        />
      </motion.div>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ display: 'flex', gap: 8, zIndex: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
