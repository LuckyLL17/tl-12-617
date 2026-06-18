import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { authAPI } from './services/api';
import Layout from './components/Layout';
import Home from './pages/Home';
import Movies from './pages/Movies';
import MovieDetail from './pages/MovieDetail';
import Cinemas from './pages/Cinemas';
import CinemaDetail from './pages/CinemaDetail';
import OrderConfirm from './pages/OrderConfirm';
import SeatSelection from './pages/SeatSelection';
import Payment from './pages/Payment';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import OrderDetail from './pages/OrderDetail';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMovies from './pages/admin/Movies';
import AdminCinemas from './pages/admin/Cinemas';
import AdminSchedules from './pages/admin/Schedules';
import AdminOrders from './pages/admin/Orders';
import AdminUsers from './pages/admin/Users';

function PrivateRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { user, updateUser } = useAuthStore();

  useEffect(() => {
    if (user && !user.created_at) {
      authAPI.getProfile().then(res => {
        updateUser(res.data);
      }).catch(err => {
        console.error('获取用户信息失败:', err);
      });
    }
  }, [user, updateUser]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="movies" element={<Movies />} />
        <Route path="movies/:id" element={<MovieDetail />} />
        <Route path="cinemas" element={<Cinemas />} />
        <Route path="cinemas/:id" element={<CinemaDetail />} />
        <Route path="schedules/:id/confirm" element={
          <PrivateRoute>
            <OrderConfirm />
          </PrivateRoute>
        } />
        <Route path="schedules/:id/seats" element={
          <PrivateRoute>
            <SeatSelection />
          </PrivateRoute>
        } />
        <Route path="schedules/:id/payment" element={
          <PrivateRoute>
            <Payment />
          </PrivateRoute>
        } />
        <Route path="orders/:id/payment" element={
          <PrivateRoute>
            <Payment />
          </PrivateRoute>
        } />
        <Route path="orders/:id" element={
          <PrivateRoute>
            <OrderDetail />
          </PrivateRoute>
        } />
        <Route path="profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      <Route path="/admin" element={
        <PrivateRoute requireAdmin>
          <AdminLayout />
        </PrivateRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="movies" element={<AdminMovies />} />
        <Route path="cinemas" element={<AdminCinemas />} />
        <Route path="schedules" element={<AdminSchedules />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
