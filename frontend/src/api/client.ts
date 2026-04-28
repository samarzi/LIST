import axios from 'axios';
import { useAuthStore } from '../store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
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
      window.dispatchEvent(new CustomEvent('list:unauthorized'));
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
  update: (data: { displayName?: string; firstName?: string; lastName?: string }) => api.put<User>('/users/me', data),
  getById: (id: number) => api.get<User>(`/users/${id}`),
  analytics: () => api.get<{ totalUsers: number; onlineUsers: number; dailyActiveUsers: number }>('/users/analytics'),
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
  delete: (id: number) => api.delete<{ success: boolean }>(`/goals/${id}`),
};

// Upload
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ success: boolean; url: string; key: string; mimeType: string; size: number }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post<{ success: boolean; files: Array<{ url: string; key: string }> }>('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Tasks
export const tasksApi = {
  list: (archived = false) => api.get<Task[]>(`/tasks${archived ? '?archived=true' : ''}`),
  create: (data: { title: string; description?: string; deadline?: string; reminderTime?: string }) => api.post<Task>('/tasks', data),
  update: (id: number, data: { title?: string; description?: string; completed?: boolean; deadline?: string | null; reminderTime?: string }) =>
    api.put<Task>(`/tasks/${id}`, data),
  createSubtask: (taskId: number, title: string) => api.post<TaskSubtask>(`/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (taskId: number, subtaskId: number, data: { title?: string; completed?: boolean }) =>
    api.put<TaskSubtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, data),
  deleteSubtask: (taskId: number, subtaskId: number) => api.delete<{ success: boolean }>(`/tasks/${taskId}/subtasks/${subtaskId}`),
  delete: (id: number) => api.delete<{ success: boolean }>(`/tasks/${id}`),
};

// Habits
export const habitsApi = {
  list: () => api.get<Habit[]>('/habits'),
  create: (data: { title: string; description?: string; targetDays: string[]; deadline?: string }) => api.post<Habit>('/habits', data),
  update: (id: number, data: { title?: string; description?: string; targetDays?: string[]; deadline?: string | null }) => api.put<Habit>(`/habits/${id}`, data),
  delete: (id: number) => api.delete<{ success: boolean }>(`/habits/${id}`),
  toggle: (id: number) => api.post<{ completed: boolean }>(`/habits/${id}/toggle`),
};

// Pair Messages
export interface PairMessage {
  id: number;
  content: string;
  type: 'question' | 'improvement' | 'feedback';
  createdAt: string;
  sender: {
    id: number;
    username: string | null;
    displayName: string | null;
  };
  isFromMe: boolean;
}

export const pairMessagesApi = {
  list: () => api.get<PairMessage[]>('/pair-messages'),
  create: (data: { content: string; type?: 'question' | 'improvement' | 'feedback' }) => api.post<PairMessage>('/pair-messages', data),
};

// Pairs
export const pairsApi = {
  current: () => api.get<PairStatus>('/pairs/current'),
  myPartners: () => api.get<WatcherStudent[]>('/pairs/my-partners'),
  changePair: (reason: string) => api.post('/pairs/change', { reason }),
  joinQueue: () => api.post<{ success: boolean; message: string; matched: boolean; partner?: any }>('/pairs/queue/join'),
  leaveQueue: () => api.post<{ success: boolean; message: string }>('/pairs/queue/leave'),
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
  portfolio: () => api.get<{ goals: VotingSession[] }>('/voting/portfolio'),
  vote: (sessionId: number, data: { scoreGoal: number; scoreWatcher: number }) =>
    api.post(`/voting/${sessionId}/vote`, data),
};

// Teachers
export const teachersApi = {
  list: (params?: { topic?: string; minRating?: number }) =>
    api.get<TeacherProfile[]>('/teachers', { params }),
  apply: (topic: string, description: string) =>
    api.post('/teachers/apply', { topic, description }),
  enroll: (teacherProfileId: number) =>
    api.post<{ success: boolean; price: number }>(`/teachers/${teacherProfileId}/enroll`),
};

// Listings
export const listingsApi = {
  list: (type?: string) => api.get<{ listings: Listing[] }>(`/listings${type ? `?type=${type}` : ''}`),
  my: () => api.get<{ listings: Listing[] }>('/listings/my'),
  create: (data: { type: string; title: string; description?: string; skills?: string[] }) =>
    api.post<Listing>('/listings', data),
  update: (id: number, data: { title?: string; description?: string; skills?: string[]; status?: string }) =>
    api.put<Listing>(`/listings/${id}`, data),
  delete: (id: number) => api.delete<{ success: boolean }>(`/listings/${id}`),
};

// Types
export type User = {
  id: number;
  telegramId: number;
  username?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
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
  lastSeenAt?: string;
  teacherProfile?: {
    topic: string;
    description: string;
    status: string;
    studentsCount: number;
  } | null;
};

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
  asPartner: {
    id: number;
    status: string;
    createdAt: string;
    watcher: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'>;
  } | null;
  asWatcher: {
    id: number;
    status: string;
    createdAt: string;
    partner: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'>;
  } | null;
  inQueue: boolean;
}

export interface WatcherStudent {
  pairId: number;
  partner: Pick<User, 'id' | 'username' | 'displayName' | 'photoUrl' | 'level' | 'rating'> & {
    activeGoals: Array<{
      id: number;
      title: string;
      successCriteria: string;
      deadline: string;
      status: string;
      checkinsCount: number;
      latestProof: { description: string; mediaUrls: string[] } | null;
    }>;
  };
}

export interface LitTransaction {
  id: number;
  userId: number;
  type: string;
  amount: number;
  note?: string;
  relatedId?: number;
  createdAt: Date;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  deadline?: string;
  reminderTime?: string;
  reminderSent: boolean;
  archivedAt?: string;
  subtasks: TaskSubtask[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskSubtask {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: number;
  title: string;
  description?: string;
  targetDays: string[];
  deadline?: string;
  reminderTime?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  completedToday: boolean;
}

export interface LitHistory {
  transactions: LitTransaction[];
  total: number;
  page: number;
  pages: number;
}

export interface Listing {
  id: number;
  type: string;
  title: string;
  description?: string;
  skills: string[];
  status?: string;
  createdAt: string;
  user: {
    id: number;
    username?: string;
    displayName?: string;
    photoUrl?: string;
    level: number;
    rating: number;
  };
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
