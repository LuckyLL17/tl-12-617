import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    if (config.params) {
      config.params._t = Date.now();
    } else {
      config.params = { _t: Date.now() };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// 座位类型定义：包含可用、已售、锁定状态
export interface Seat {
  available: boolean;
  sold: boolean;
  locked: boolean;
  locked_by: string | null;
  locked_until: string | null;
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  description: string;
  duration: number;
  rating: number;
  release_date: string;
  genre: string;
  director: string;
  cast: string;
  status: string;
  created_at: string;
}

export interface Cinema {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  image: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  movie_id: string;
  cinema_id: string;
  start_time: string;
  end_time: string;
  hall: string;
  price: number;
  seats: { [key: string]: Seat };
  movie_title?: string;
  cinema_name?: string;
  poster?: string;
  duration?: number;
  rating?: number;
  address?: string;
}

export interface Order {
  id: string;
  user_id: string;
  schedule_id: string;
  seats: string[];
  total_price: number;
  status: string;
  created_at: string;
  start_time?: string;
  hall?: string;
  price?: number;
  movie_title?: string;
  poster?: string;
  duration?: number;
  cinema_name?: string;
  address?: string;
}

export interface User {
  id: string;
  username: string;
  nickname: string;
  phone?: string;
  avatar?: string;
  role: string;
  created_at: string;
}

export interface City {
  city: string;
  districts: string[];
  initial?: string;
}

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (data: { username: string; password: string; confirmPassword: string; nickname: string; phone: string }) =>
    api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { nickname?: string; phone?: string; avatar?: string }) =>
    api.put('/auth/profile', data)
};

export const movieAPI = {
  getMovies: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<Movie[]>('/movies', { params }),
  getMovie: (id: string) => api.get<Movie>(`/movies/${id}`),
  getMovieSchedules: (id: string, params?: { date?: string; cinema_id?: string }) =>
    api.get(`/movies/${id}/schedules`, { params }),
  createMovie: (data: Partial<Movie>) => api.post('/movies', data),
  updateMovie: (id: string, data: Partial<Movie>) => api.put(`/movies/${id}`, data),
  deleteMovie: (id: string) => api.delete(`/movies/${id}`)
};

export const cinemaAPI = {
  getCinemas: (params?: { city?: string; district?: string }) =>
    api.get<Cinema[]>('/cinemas', { params }),
  getCities: () => api.get<City[]>('/cinemas/cities'),
  getCinema: (id: string) => api.get<Cinema>(`/cinemas/${id}`),
  getCinemaSchedules: (id: string, params?: { date?: string }) =>
    api.get(`/cinemas/${id}/schedules`, { params }),
  createCinema: (data: Partial<Cinema>) => api.post('/cinemas', data),
  updateCinema: (id: string, data: Partial<Cinema>) => api.put(`/cinemas/${id}`, data),
  deleteCinema: (id: string) => api.delete(`/cinemas/${id}`)
};

export const scheduleAPI = {
  getSchedules: (params?: { movie_id?: string; cinema_id?: string; date?: string }) =>
    api.get<Schedule[]>('/schedules', { params }),
  getSchedule: (id: string) => api.get<Schedule>(`/schedules/${id}`),
  // 根据人数推荐相邻座位
  recommendSeats: (id: string, count: number) =>
    api.post<{ recommended: string[]; message?: string }>(`/schedules/${id}/recommend`, { count }),
  // 锁定选中的座位
  lockSeats: (id: string, seats: string[]) =>
    api.post<{ message: string; locked_until: string }>(`/schedules/${id}/lock`, { seats }),
  // 解锁座位
  unlockSeats: (id: string) =>
    api.delete(`/schedules/${id}/lock`),
  createSchedule: (data: Partial<Schedule>) => api.post('/schedules', data),
  updateSchedule: (id: string, data: Partial<Schedule>) => api.put(`/schedules/${id}`, data),
  deleteSchedule: (id: string) => api.delete(`/schedules/${id}`)
};

export const orderAPI = {
  getOrders: () => api.get<Order[]>('/orders'),
  getOrder: (id: string) => api.get<Order>(`/orders/${id}`),
  // 创建订单（状态为 pending）
  createOrder: (data: { schedule_id: string; seats: string[] }) =>
    api.post('/orders', data),
  // 支付订单（pending → paid）
  payOrder: (id: string) =>
    api.put(`/orders/${id}/pay`),
  // 取消订单（pending → cancelled，释放座位）
  cancelOrder: (id: string) =>
    api.put(`/orders/${id}/cancel`),
  updateOrderStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status })
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/admin/users')
};

export default api;
