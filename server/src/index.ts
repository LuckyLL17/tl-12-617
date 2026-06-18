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
 * 释放过期订单锁定的座位
 * 扫描所有pending状态且已过期的订单，将其状态改为cancelled，并释放对应的座位锁定
 */
const releaseExpiredOrders = () => {
  const now = new Date().toISOString();
  
  // 查询所有已过期的待支付订单
  const expiredOrders = db.prepare(`
    SELECT id, schedule_id, seats 
    FROM orders 
    WHERE status = 'pending' AND expires_at < ?
  `).all(now) as any[];
  
  if (expiredOrders.length === 0) {
    return;
  }
  
  const updateOrderStmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const getScheduleStmt = db.prepare('SELECT seats FROM schedules WHERE id = ?');
  const updateScheduleStmt = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  // 按排片分组处理
  const scheduleMap = new Map<string, string[]>();
  expiredOrders.forEach(order => {
    if (!scheduleMap.has(order.schedule_id)) {
      scheduleMap.set(order.schedule_id, []);
    }
    scheduleMap.get(order.schedule_id)!.push(order.id);
  });
  
  // 使用事务处理每个排片
  scheduleMap.forEach((orderIds, scheduleId) => {
    const schedule = getScheduleStmt.get(scheduleId) as any;
    if (!schedule) return;
    
    const seats = JSON.parse(schedule.seats);
    
    const tx = db.transaction(() => {
      // 更新所有相关订单状态
      orderIds.forEach(orderId => {
        updateOrderStmt.run('cancelled', orderId);
        
        // 释放该订单锁定的座位
        const order = expiredOrders.find(o => o.id === orderId);
        if (order) {
          const orderSeats = JSON.parse(order.seats);
          orderSeats.forEach((seatId: string) => {
            if (seats[seatId] && seats[seatId].locked_order_id === orderId) {
              seats[seatId].locked = false;
              seats[seatId].locked_order_id = null;
            }
          });
        }
      });
      
      // 更新排片的座位数据
      updateScheduleStmt.run(JSON.stringify(seats), scheduleId);
    });
    
    tx();
  });
  
  if (expiredOrders.length > 0) {
    console.log(`[定时任务] 已释放 ${expiredOrders.length} 个过期订单的座位锁定`);
  }
};

/** 启动定时任务，每60秒检查一次过期订单 */
const startExpiredOrderCleanup = () => {
  setInterval(releaseExpiredOrders, 60 * 1000);
  console.log('⏰ 过期订单清理定时任务已启动');
};

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
  
  // 启动过期订单清理定时任务
  startExpiredOrderCleanup();
});
