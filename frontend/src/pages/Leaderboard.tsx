import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Target, Crown } from 'lucide-react';
import { leaderboardApi, type LeaderboardUser } from '../api/client';
import { useAuthStore } from '../store';

const TABS = [
  { id: 'rating', label: 'Рейтинг', icon: Star },
  { id: 'lit', label: 'LIT', icon: Zap },
  { id: 'goals', label: 'Цели', icon: Target },
];

export default function LeaderboardPage() {
  const { user: me } = useAuthStore();
  const [type, setType] = useState<'rating' | 'lit' | 'goals'>('rating');
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    leaderboardApi.get(type).then(({ data }) => {
      setUsers(data.users);
      setMyRank(data.myRank);
    }).finally(() => setLoading(false));
  }, [type]);

  const topThree = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="px-4" style={{ paddingTop: 24, paddingBottom: 12 }}>
        <h1 className="title-lg text-gradient">Рейтинг</h1>
        {myRank && (
          <p className="body-sm text-faint mt-1">Ты на <span style={{ color: 'var(--accent)' }}>#{myRank}</span> месте</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: 16, WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = type === tab.id;
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setType(tab.id as typeof type)}
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
              {tab.label}
            </motion.button>
          );
        })}
        <div style={{ flexShrink: 0, width: 16 }} />
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <>
          {/* Top 3 podium */}
          {topThree.length === 3 && (
            <div
              className="px-4"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 24,
              }}
            >
              <PodiumItem user={topThree[1]} position={2} type={type} />
              <PodiumItem user={topThree[0]} position={1} type={type} />
              <PodiumItem user={topThree[2]} position={3} type={type} />
            </div>
          )}

          {/* Empty state */}
          {users.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Trophy size={28} color="var(--text-3)" />
              </div>
              <div>
                <h3 className="title-sm">Рейтинг пуст</h3>
                <p className="body-sm text-faint mt-2">Выполняй цели — и окажешься на вершине</p>
              </div>
            </div>
          )}

          {/* Rest */}
          <div className="px-4">
            {rest.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3"
                style={{
                  padding: '12px 14px',
                  background: user.id === me?.id ? 'rgba(99,102,241,0.08)' : 'var(--surface)',
                  border: `1px solid ${user.id === me?.id ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  #{user.rank}
                </div>

                <UserAvatar user={user} size={36} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="body-sm truncate" style={{ fontWeight: 600 }}>
                    {user.displayName ?? user.username ?? 'Пользователь'}
                    {user.id === me?.id && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 4 }}>ты</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="caption text-faint">Lvl {user.level}</span>
                    {user.isTeacher && <span className="badge badge-accent" style={{ padding: '0 4px', fontSize: 9 }}>T</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {type === 'rating' && user.rating.toFixed(1)}
                    {type === 'lit' && `${user.litBalance}`}
                    {type === 'goals' && user.totalGoalsCompleted}
                  </div>
                  <div className="caption text-faint">
                    {type === 'rating' ? '/5.0' : type === 'lit' ? 'LIT' : 'целей'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PodiumItem({ user, position, type }: { user: LeaderboardUser; position: number; type: string }) {
  const heights = { 1: 90, 2: 70, 3: 55 };
  const h = heights[position as 1 | 2 | 3] ?? 55;
  const colors = { 1: '#FFD60A', 2: '#C0C0C0', 3: '#CD7F32' };
  const color = colors[position as 1 | 2 | 3] ?? '#fff';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        flex: position === 1 ? 1.1 : 1,
      }}
    >
      {position === 1 && <Crown size={20} color="#FFD60A" />}

      <UserAvatar user={user} size={position === 1 ? 52 : 44} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 70, lineHeight: 1.2 }} className="truncate">
          {user.displayName ?? user.username ?? '?'}
        </div>
        <div style={{ fontSize: 11, color: color, fontWeight: 700, marginTop: 2 }}>
          {type === 'rating' && user.rating.toFixed(1)}
          {type === 'lit' && `${user.litBalance} LIT`}
          {type === 'goals' && `${user.totalGoalsCompleted} ц`}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: h,
          background: `linear-gradient(180deg, ${color}22 0%, ${color}11 100%)`,
          border: `1px solid ${color}44`,
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trophy size={position === 1 ? 24 : 18} color={color} />
      </div>
    </motion.div>
  );
}

function UserAvatar({ user, size }: { user: LeaderboardUser; size: number }) {
  const name = user.displayName ?? user.username ?? '?';
  if (user.photoUrl) {
    return <img src={user.photoUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #0A84FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="px-4 flex-col gap-2 flex">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />
      ))}
    </div>
  );
}
