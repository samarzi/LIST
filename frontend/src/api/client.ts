import axios from 'axios';
import { useAuthStore } from '../store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  loginTelegram: (initData: string) =>
    api.post<{ token: string; user: User }>('/auth/telegram', { initData }),
};

// Users
export const usersApi = {
  me: () => api.get<User>('/users/me'),
  update: (data: Partial<Pick<User, 'displayName' | 'firstName' | 'lastName'>>) =>
    api.patch<User>('/users/me', data),
  getById: (id: number) => api.get<User>(`/users/${id}`),
};

// Goals
export const goalsApi = {
  list: () => api.get<Goal[]>('/goals'),
  create: (data: CreateGoalDto) => api.post<{ id: number; status: string }>('/goals', data),
  getById: (id: number) => api.get<GoalDetail>(`/goals/${id}`),
  setDifficulty: (id: number, difficulty: number, comment?: string) =>
    api.put(`/goals/${id}/difficulty`, { difficulty, comment }),
  submitProof: (id: number, data: { description: string; mediaUrls?: string[] }) =>
    api.post(`/goals/${id}/proof`, data),
  confirmProof: (id: number, confirmed: boolean, note?: string) =>
    api.post(`/goals/${id}/confirm`, { confirmed, note }),
  checkin: (goalId: number, content?: string, mediaUrls?: string[]) =>
    api.post('/goals/checkin', { goalId, content, mediaUrls }),
};

// Pairs
export const pairsApi = {
  current: () => api.get<PairStatus>('/pairs/current'),
  myStudents: () => api.get<WatcherStudent[]>('/pairs/my-students'),
  changePair: (reason: string) => api.post('/pairs/change', { reason }),
};

// LIT
export const litApi = {
  balance: () => api.get<{ balance: number }>('/lit/balance'),
  history: (page?: number) => api.get<LitHistory>(`/lit/history?page=${page ?? 1}`),
};

// Leaderboard
export const leaderboardApi = {
  get: (type?: 'rating' | 'lit' | 'goals') =>
    api.get<LeaderboardResponse>(`/leaderboard?type=${type ?? 'rating'}`),
};

// Voting
export const votingApi = {
  next: () => api.get<{ session: VotingSession | null }>('/voting/next'),
  vote: (id: number, scoreGoal: number, scoreWatcher: number) =>
    api.post(`/voting/${id}/vote`, { scoreGoal, scoreWatcher }),
};

// Teachers
export const teachersApi = {
  list: (params?: { topic?: string; minRating?: number }) =>
    api.get<TeacherProfile[]>('/teachers', { params }),
  apply: (topic: string, description: string) =>
    api.post('/teachers/apply', { topic, description }),
};

// Types
export interface User {
  id: number;
  telegramId: number;
  username: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  level: number;
  rating: number;
  litBalance: number;
  isTeacher: boolean;
  isArbitrator: boolean;
  teacherRating: number | null;
  freezeCount30d: number;
  totalGoalsCompleted: number;
  totalGoalsFailed: number;
  createdAt: string;
  teacherProfile?: {
    topic: string | null;
    description: string | null;
    status: string;
    studentsCount: number;
  } | null;
}

export interface Goal {
  id: number;
  title: string;
  successCriteria: string;
  motivation: string | null;
  proofType: string | null;
  deadline: string;
  difficulty: number | null;
  stakeLit: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  checkinsCount: number;
  votingSession: {
    status: string;
    deadline: string;
    votesCount: number;
  } | null;
}

export interface GoalDetail extends Goal {
  isOwner: boolean;
  actionPlan: string | null;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level'>;
  checkins: Array<{
    id: number;
    content: string | null;
    mediaUrls: string[];
    confirmed: boolean;
    createdAt: string;
  }>;
  latestProof: {
    description: string;
    mediaUrls: string[];
    watcherConfirmed: boolean | null;
  } | null;
}

export interface CreateGoalDto {
  title: string;
  successCriteria: string;
  motivation?: string;
  actionPlan?: string;
  proofType: 'video' | 'screenshot' | 'link' | 'document' | 'combined';
  deadline: string;
  stakeLit?: number;
}

export interface PairStatus {
  asStudent: {
    id: number;
    status: string;
    createdAt: string;
    watcher: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'>;
  } | null;
  asWatcher: {
    id: number;
    status: string;
    createdAt: string;
    student: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'>;
  } | null;
  inQueue: boolean;
}

export interface WatcherStudent {
  pairId: number;
  student: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'> & {
    activeGoals: Array<{
      id: number;
      title: string;
      deadline: string;
      status: string;
      checkinsCount: number;
    }>;
  };
}

export interface LitTransaction {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
}

export interface LitHistory {
  transactions: LitTransaction[];
  total: number;
  page: number;
  pages: number;
}

export interface LeaderboardUser {
  rank: number;
  id: number;
  username: string | null;
  displayName: string | null;
  photoUrl: string | null;
  level: number;
  rating: number;
  litBalance: number;
  totalGoalsCompleted: number;
  isTeacher: boolean;
  isArbitrator: boolean;
}

export interface LeaderboardResponse {
  users: LeaderboardUser[];
  myRank: number;
}

export interface VotingSession {
  id: number;
  goalId: number;
  requiredVotes: number;
  votesCount: number;
  deadline: string;
  goal: {
    id: number;
    title: string;
    successCriteria: string;
    difficulty: number | null;
    user: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level'>;
    proof: { description: string; mediaUrls: string[] } | null;
  };
}

export interface TeacherProfile {
  id: number;
  userId: number;
  topic: string | null;
  description: string | null;
  status: string;
  studentsCount: number;
  trialStudents: number;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'> & {
    teacherRating: number | null;
    totalGoalsCompleted: number;
    price: number;
  };
}
