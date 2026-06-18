import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import { cleanupExpiredOrders } from './routes/orders';
import authRoutes from './routes/auth';
import movieRoutes from './routes/movies';
import cinemaRoutes from './routes/cinemas';
import scheduleRoutes from './routes/schedules';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库（创建表和初始数据）
initDatabase();

app.use(cors());
app.use(express.json());

// 禁用所有API响应的缓存，确保客户端始终获取最新数据
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// 注册API路由
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '电影售票系统服务运行正常' });
});

// 托管前端静态文件
const distPath = path.join(__dirname, '../../client/dist');
app.use(express.static(distPath));

// 前端路由回退（SPA应用所有路由都返回index.html）
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

/**
 * 定时清理超时未支付的订单（每60秒执行一次）
 *
 * 这是订单超时自动取消的"定时清理"部分，与 orders.ts 中的"惰性清理"形成双重保障：
 * - 惰性清理：用户每次调用订单API时触发，保证查询结果实时准确
 * - 定时清理：无论是否有用户访问，都能定期清理超时订单，释放被占用的座位
 *
 * 清理逻辑：
 * 1. 查找所有 status='pending' 且创建时间超过15分钟的订单
 * 2. 将订单状态更新为 'cancelled'
 * 3. 将订单中占用的座位恢复为可选状态
 */
const ORDER_CLEANUP_INTERVAL_MS = 60 * 1000; // 每60秒清理一次

setInterval(() => {
  try {
    const cancelledCount = cleanupExpiredOrders();
    if (cancelledCount > 0) {
      console.log(`[订单清理] 已自动取消 ${cancelledCount} 个超时未支付订单，座位已释放`);
    }
  } catch (error) {
    console.error('[订单清理] 清理超时订单时出错:', error);
  }
}, ORDER_CLEANUP_INTERVAL_MS);
