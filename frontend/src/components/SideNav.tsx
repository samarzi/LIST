import { motion } from 'framer-motion';
import { useUIStore } from '../store';

const NAV_ITEMS = [
  { id: 'goals', label: 'Цели', icon: '🎯' },
  { id: 'watch', label: 'Смотрящий', icon: '👁️' },
  { id: 'leaderboard', label: 'Рейтинг', icon: '🏆' },
  { id: 'lit', label: 'LIT', icon: '💎' },
  { id: 'teachers', label: 'Учителя', icon: '👨‍🏫' },
];

export default function SideNav() {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col bg-[var(--bg-2)] border-r border-[var(--border)] z-50"
    >
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
          >
            <span className="text-xl font-bold text-white">L</span>
          </div>
          <span className="text-xl font-bold text-[var(--text)]">LIST</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {NAV_ITEMS.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id
                ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 text-white border border-indigo-500/30'
                : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </motion.button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="text-xs text-[var(--text-3)] text-center">
          <p>LIST v1.0</p>
          <p className="mt-1">Desktop Mode</p>
        </div>
      </div>
    </motion.aside>
  );
}
