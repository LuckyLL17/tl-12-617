import { Router } from 'express';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const stats: any = {};
  
  stats.movies = (db.prepare('SELECT COUNT(*) as total FROM movies').get() as any).total;
  stats.cinemas = (db.prepare('SELECT COUNT(*) as total FROM cinemas').get() as any).total;
  stats.schedules = (db.prepare('SELECT COUNT(*) as total FROM schedules').get() as any).total;
  stats.users = (db.prepare('SELECT COUNT(*) as total FROM users').get() as any).total;
  stats.orders = (db.prepare('SELECT COUNT(*) as total FROM orders').get() as any).total;
  stats.revenue = (db.prepare('SELECT COALESCE(SUM(total_price), 0) as total FROM orders').get() as any).total;
  
  stats.last7Days = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue
    FROM orders
    WHERE created_at >= date('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();
  
  res.json(stats);
});

router.get('/users', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const users = db.prepare('SELECT id, username, nickname, phone, avatar, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

export default router;
