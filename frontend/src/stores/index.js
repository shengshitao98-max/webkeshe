import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

export const useVideoStore = create((set) => ({
  videos: [],
  selectedVideo: null,
  analysisResult: null,
  setVideos: (videos) => set({ videos }),
  setSelectedVideo: (video) => set({ selectedVideo: video }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
}));

export const useReviewStore = create((set) => ({
  pendingReviews: [],
  reviewHistory: [],
  setPendingReviews: (reviews) => set({ pendingReviews: reviews }),
  setReviewHistory: (reviews) => set({ reviewHistory: reviews }),
}));

export const useStatisticsStore = create((set) => ({
  dailyStats: null,
  overallStats: null,
  categoryStats: null,
  keywordStats: null,
  setDailyStats: (stats) => set({ dailyStats: stats }),
  setOverallStats: (stats) => set({ overallStats: stats }),
  setCategoryStats: (stats) => set({ categoryStats: stats }),
  setKeywordStats: (stats) => set({ keywordStats: stats }),
}));
