import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/** 锁座超时时间（秒），默认15分钟 */
const LOCK_TIMEOUT_SECONDS = 15 * 60;

/**
 * 获取订单列表
 * 管理员可查看所有订单，普通用户只能查看自己的订单
 */
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  
  let query = `
    SELECT o.*, s.start_time, s.hall, s.price, m.title as movie_title, m.poster, c.name as cinema_name
    FROM orders o
    JOIN schedules s ON o.schedule_id = s.id
    JOIN movies m ON s.movie_id = m.id
    JOIN cinemas c ON s.cinema_id = c.id
  `;
  const params: any[] = [];
  
  if (userRole !== 'admin') {
    query += ' WHERE o.user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY o.created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  
  rows.forEach(row => {
    if (row.seats) {
      row.seats = JSON.parse(row.seats);
    }
  });
  
  res.json(rows);
});

/**
 * 获取订单详情
 * 管理员可查看任意订单，普通用户只能查看自己的订单
 */
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  
  let query = `
    SELECT o.*, s.start_time, s.hall, s.price, m.title as movie_title, m.poster, m.duration,
           c.name as cinema_name, c.address
    FROM orders o
    JOIN schedules s ON o.schedule_id = s.id
    JOIN movies m ON s.movie_id = m.id
    JOIN cinemas c ON s.cinema_id = c.id
    WHERE o.id = ?
  `;
  const params: any[] = [id];
  
  if (userRole !== 'admin') {
    query += ' AND o.user_id = ?';
    params.push(userId);
  }

  const row = db.prepare(query).get(...params) as any;
  if (!row) {
    return res.status(404).json({ message: '订单不存在' });
  }
  
  if (row.seats) {
    row.seats = JSON.parse(row.seats);
  }
  
  res.json(row);
});

/**
 * 创建订单（锁座）
 * 1. 检查座位是否可用且未被锁定
 * 2. 创建pending状态的订单
 * 3. 锁定座位并设置过期时间
 */
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { schedule_id, seats } = req.body;
  
  if (!schedule_id || !seats || seats.length === 0) {
    return res.status(400).json({ message: '参数不完整' });
  }
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const currentSeats = JSON.parse(schedule.seats);
  
  // 检查座位状态
  for (const seatId of seats) {
    const seat = currentSeats[seatId];
    if (!seat || !seat.available) {
      return res.status(400).json({ message: `座位 ${seatId} 不可用` });
    }
    if (seat.sold) {
      return res.status(400).json({ message: `座位 ${seatId} 已售出` });
    }
    if (seat.locked) {
      return res.status(400).json({ message: `座位 ${seatId} 已被锁定，请选择其他座位` });
    }
  }
  
  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();
  
  // 计算过期时间
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_SECONDS * 1000).toISOString();
  
  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 创建待支付订单
    insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'pending', expiresAt);
    
    // 锁定座位
    for (const seatId of seats) {
      currentSeats[seatId].locked = true;
      currentSeats[seatId].locked_order_id = orderId;
    }
    
    updateSeats.run(JSON.stringify(currentSeats), schedule_id);
  });
  
  tx();
  
  res.json({
    id: orderId,
    message: '锁座成功，请在15分钟内完成支付',
    order: {
      id: orderId,
      total_price: totalPrice,
      seats: seats,
      schedule_id: schedule_id,
      status: 'pending',
      expires_at: expiresAt
    }
  });
});

/**
 * 订单支付接口
 * 将pending状态的订单改为paid状态，并将座位从锁定改为已售
 */
router.post('/:id/pay', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }
  
  if (order.status === 'paid') {
    return res.status(400).json({ message: '订单已支付，请勿重复支付' });
  }
  
  if (order.status === 'cancelled') {
    return res.status(400).json({ message: '订单已取消' });
  }
  
  if (order.status === 'pending' && new Date(order.expires_at) < new Date()) {
    return res.status(400).json({ message: '订单已过期，请重新下单' });
  }
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const currentSeats = JSON.parse(schedule.seats);
  const orderSeats = JSON.parse(order.seats);
  
  const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 更新订单状态为已支付
    updateOrder.run('paid', id);
    
    // 将座位从锁定改为已售
    for (const seatId of orderSeats) {
      if (currentSeats[seatId]) {
        currentSeats[seatId].locked = false;
        currentSeats[seatId].locked_order_id = null;
        currentSeats[seatId].sold = true;
      }
    }
    
    updateSeats.run(JSON.stringify(currentSeats), order.schedule_id);
  });
  
  tx();
  
  res.json({ message: '支付成功' });
});

/**
 * 取消订单接口
 * 取消pending状态的订单，并释放锁定的座位
 */
router.post('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  
  let order: any;
  if (userRole === 'admin') {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  } else {
    order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, userId) as any;
  }
  
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }
  
  if (order.status !== 'pending') {
    return res.status(400).json({ message: '只有待支付订单可以取消' });
  }
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const currentSeats = JSON.parse(schedule.seats);
  const orderSeats = JSON.parse(order.seats);
  
  const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 更新订单状态为已取消
    updateOrder.run('cancelled', id);
    
    // 释放锁定的座位
    for (const seatId of orderSeats) {
      if (currentSeats[seatId] && currentSeats[seatId].locked_order_id === id) {
        currentSeats[seatId].locked = false;
        currentSeats[seatId].locked_order_id = null;
      }
    }
    
    updateSeats.run(JSON.stringify(currentSeats), order.schedule_id);
  });
  
  tx();
  
  res.json({ message: '订单已取消，座位已释放' });
});

/**
 * 智能推荐座位接口
 * 根据人数推荐最佳座位（优先推荐中间区域的连续座位）
 * 推荐策略：
 * 1. 优先选择银幕中央的座位（中间行）
 * 2. 优先选择同一排的连续座位
 * 3. 从中间向两边扩散查找
 */
router.get('/:schedule_id/recommend-seats', (req, res) => {
  const { schedule_id } = req.params;
  const count = parseInt(req.query.count as string, 10) || 1;
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const seats = JSON.parse(schedule.seats);
  const rows = 8;
  const cols = 12;
  
  // 检查座位是否可选（未售出、未锁定、可用）
  const isSeatAvailable = (seatId: string): boolean => {
    const seat = seats[seatId];
    return seat && seat.available && !seat.sold && !seat.locked;
  };
  
  // 生成座位ID
  const getSeatId = (row: number, col: number): string => {
    return `${String.fromCharCode(65 + row)}${col + 1}`;
  };
  
  // 计算座位到中心的距离（用于排序，越靠近中心越好）
  // 中心位置：第3-4行（索引2-3），第5-6列（索引5-6）
  const getDistanceFromCenter = (row: number, col: number): number => {
    const centerRow1 = 3;
    const centerRow2 = 4;
    const centerCol1 = 5;
    const centerCol2 = 6;
    
    const rowDist = Math.min(Math.abs(row - centerRow1), Math.abs(row - centerRow2));
    const colDist = Math.min(Math.abs(col - centerCol1), Math.abs(col - centerCol2));
    
    return rowDist * 2 + colDist;
  };
  
  // 查找连续座位
  const findConsecutiveSeats = (): string[] | null => {
    // 存储所有可能的连续座位组合及其分数
    const candidates: { seats: string[]; score: number }[] = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - count; c++) {
        let allAvailable = true;
        const seatIds: string[] = [];
        
        for (let i = 0; i < count; i++) {
          const seatId = getSeatId(r, c + i);
          seatIds.push(seatId);
          if (!isSeatAvailable(seatId)) {
            allAvailable = false;
            break;
          }
        }
        
        if (allAvailable) {
          // 计算分数：距离中心越近分数越高
          const midCol = c + Math.floor(count / 2);
          const score = -getDistanceFromCenter(r, midCol);
          candidates.push({ seats: seatIds, score });
        }
      }
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 按分数排序，选择最优的
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].seats;
  };
  
  // 如果找不到连续座位，尝试找分散的座位
  const findAnySeats = (): string[] | null => {
    const availableSeats: { id: string; score: number }[] = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatId = getSeatId(r, c);
        if (isSeatAvailable(seatId)) {
          const score = -getDistanceFromCenter(r, c);
          availableSeats.push({ id: seatId, score });
        }
      }
    }
    
    if (availableSeats.length < count) {
      return null;
    }
    
    // 按分数排序，选最好的几个
    availableSeats.sort((a, b) => b.score - a.score);
    return availableSeats.slice(0, count).map(s => s.id);
  };
  
  let recommendedSeats: string[] | null = null;
  
  if (count === 1) {
    recommendedSeats = findAnySeats();
  } else {
    // 先找连续座位
    recommendedSeats = findConsecutiveSeats();
    // 找不到连续的就找分散的
    if (!recommendedSeats) {
      recommendedSeats = findAnySeats();
    }
  }
  
  if (!recommendedSeats) {
    return res.status(400).json({ message: `没有找到 ${count} 个可用座位` });
  }
  
  res.json({
    seats: recommendedSeats.sort(),
    message: '推荐成功'
  });
});

/**
 * 管理员更新订单状态
 */
router.put('/:id/status', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: '更新成功' });
});

export default router;
