import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import db from './database';
import authRoutes from './routes/auth';
import movieRoutes from './routes/movies';
import cinemaRoutes from './routes/cinemas';
import scheduleRoutes from './routes/schedules';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

initDatabase();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '电影售票系统服务运行正常' });
});

/**
 * 后台定时任务：清理过期锁座和超时未支付的订单
 * 每分钟执行一次
 */
const startSeatCleanupTask = () => {
  const CLEANUP_INTERVAL = 60 * 1000; // 每分钟执行一次
  const LOCK_DURATION = 15 * 60 * 1000; // 锁座有效期15分钟

  const cleanupExpiredLocks = () => {
    const now = new Date();
    
    try {
      // 1. 获取所有排片
      const schedules = db.prepare('SELECT id, seats FROM schedules').all() as any[];
      let totalUnlockedSeats = 0;
      
      for (const schedule of schedules) {
        if (!schedule.seats) continue;
        
        const seats = JSON.parse(schedule.seats);
        let updated = false;
        
        for (const seatId of Object.keys(seats)) {
          const seat = seats[seatId];
          // 检查是否是过期的锁座
          if (seat.locked && seat.locked_until) {
            const lockUntil = new Date(seat.locked_until);
            if (lockUntil < now) {
              // 释放过期的锁座
              seat.locked = false;
              seat.locked_by = null;
              seat.locked_until = null;
              updated = true;
              totalUnlockedSeats++;
            }
          }
        }
        
        if (updated) {
          db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(
            JSON.stringify(seats),
            schedule.id
          );
        }
      }
      
      // 2. 将超时未支付的订单状态更新为 cancelled
      const pendingOrders = db.prepare(
        "SELECT id, schedule_id, seats FROM orders WHERE status = 'pending'"
      ).all() as any[];
      
      let cancelledOrders = 0;
      for (const order of pendingOrders) {
        // 订单创建时间超过15分钟则自动取消
        const createdAt = new Date(order.created_at).getTime();
        if (now.getTime() - createdAt > LOCK_DURATION) {
          // 取消订单
          db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
          cancelledOrders++;
        }
      }
      
      if (totalUnlockedSeats > 0 || cancelledOrders > 0) {
        console.log(
          `[定时清理] 释放 ${totalUnlockedSeats} 个过期锁座，取消 ${cancelledOrders} 个超时订单`
        );
      }
    } catch (error) {
      console.error('[定时清理] 清理过期锁座失败:', error);
    }
  };

  // 立即执行一次
  cleanupExpiredLocks();
  
  // 启动定时任务
  const timer = setInterval(cleanupExpiredLocks, CLEANUP_INTERVAL);
  
  // 程序退出时清理定时器
  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('[定时清理] 定时任务已停止');
    process.exit(0);
  });
};

// 启动定时清理任务
startSeatCleanupTask();

const distPath = path.join(__dirname, '../../client/dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎬 电影售票系统后端服务已启动: http://localhost:${PORT}`);
  console.log(`📱 用户端: http://localhost:${PORT}`);
  console.log(`🔧 管理端: http://localhost:${PORT}/admin`);
  console.log('');
  console.log('测试账号:');
  console.log('  管理员: admin / admin123');
  console.log('  普通用户: user1 / 123456');
});
