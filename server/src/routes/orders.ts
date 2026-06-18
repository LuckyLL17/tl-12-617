import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 锁座超时时间（分钟）
const LOCK_DURATION_MINUTES = 15;

/**
 * 座位信息类型
 */
interface SeatInfo {
  available: boolean;
  sold: boolean;
  locked?: boolean;
  locked_by?: string;
}

/**
 * 检查座位是否可用于锁定
 * @param scheduleId 排片ID
 * @param seats 座位ID数组
 * @param excludeOrderId 排除的订单ID（用于支付/取消时不检查自身）
 * @returns 第一个不可用的座位信息，全部可用返回null
 */
function checkSeatsAvailable(
  scheduleId: string,
  seatIds: string[],
  excludeOrderId?: string
): { seatId: string; reason: string } | null {
  // 获取排片的座位配置
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule) {
    return { seatId: '', reason: '排片不存在' };
  }

  const seats: { [key: string]: SeatInfo } = JSON.parse(schedule.seats);

  // 检查每个座位
  for (const seatId of seatIds) {
    const seat = seats[seatId];
    
    // 检查座位是否存在且可用
    if (!seat || !seat.available) {
      return { seatId, reason: '座位不存在或不可用' };
    }
    
    // 检查是否已售出
    if (seat.sold) {
      return { seatId, reason: '座位已售出' };
    }
  }

  // 检查是否被其他订单锁定
  const query = excludeOrderId
    ? `SELECT id, seats FROM orders 
       WHERE schedule_id = ? 
         AND status = 'pending' 
         AND locked_until > datetime('now')
         AND id != ?`
    : `SELECT id, seats FROM orders 
       WHERE schedule_id = ? 
         AND status = 'pending' 
         AND locked_until > datetime('now')`;

  const params = excludeOrderId ? [scheduleId, excludeOrderId] : [scheduleId];
  const lockedOrders = db.prepare(query).all(...params) as Array<{ id: string; seats: string }>;

  for (const order of lockedOrders) {
    const orderSeats: string[] = JSON.parse(order.seats);
    for (const seatId of seatIds) {
      if (orderSeats.includes(seatId)) {
        return { seatId, reason: '座位已被锁定，请稍后再试' };
      }
    }
  }

  return null;
}

/**
 * 清理超时的待支付订单，释放座位锁定
 */
export function cleanupExpiredOrders(): number {
  const expiredOrders = db.prepare(`
    SELECT id, schedule_id, seats 
    FROM orders 
    WHERE status = 'pending' 
      AND locked_until <= datetime('now')
  `).all() as Array<{ id: string; schedule_id: string; seats: string }>;

  if (expiredOrders.length === 0) return 0;

  const updateStatus = db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?");

  const tx = db.transaction(() => {
    for (const order of expiredOrders) {
      updateStatus.run(order.id);
    }
  });

  tx();

  return expiredOrders.length;
}

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
 * 锁座（创建待支付订单）
 * 选定座位后，先调用此接口锁定座位，用户有一定时间完成支付
 */
router.post('/hold', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { schedule_id, seats } = req.body;
  
  // 参数校验
  if (!schedule_id || !seats || seats.length === 0) {
    return res.status(400).json({ message: '参数不完整' });
  }

  if (!Array.isArray(seats) || seats.length > 10) {
    return res.status(400).json({ message: '座位数量不合法' });
  }

  // 检查排片是否存在
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  // 检查座位是否可用
  const unavailable = checkSeatsAvailable(schedule_id, seats);
  if (unavailable) {
    return res.status(400).json({ 
      message: `座位 ${unavailable.seatId} ${unavailable.reason}` 
    });
  }

  // 计算总价
  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();

  // 计算锁定截止时间
  const lockedUntil = new Date();
  lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);
  const lockedUntilStr = lockedUntil.toISOString();

  // 创建待支付订单
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status, locked_until)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `);

  insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, lockedUntilStr);

  res.json({
    id: orderId,
    message: '座位锁定成功，请在15分钟内完成支付',
    order: {
      id: orderId,
      total_price: totalPrice,
      seats: seats,
      schedule_id: schedule_id,
      status: 'pending',
      locked_until: lockedUntilStr
    }
  });
});

/**
 * 支付订单
 * 将待支付订单标记为已支付，座位标记为已售出
 */
router.post('/:id/pay', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // 获取订单信息
  let orderQuery = 'SELECT * FROM orders WHERE id = ?';
  const params: any[] = [id];
  
  if (userRole !== 'admin') {
    orderQuery += ' AND user_id = ?';
    params.push(userId);
  }

  const order = db.prepare(orderQuery).get(...params) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  // 检查订单状态
  if (order.status === 'paid') {
    return res.status(400).json({ message: '订单已支付，请勿重复支付' });
  }

  if (order.status === 'cancelled') {
    return res.status(400).json({ message: '订单已取消，无法支付' });
  }

  // 检查是否超时
  const now = new Date();
  const lockedUntil = new Date(order.locked_until);
  if (order.status === 'pending' && now > lockedUntil) {
    // 超时了，标记为已取消
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);
    return res.status(400).json({ message: '订单已超时，请重新选择座位' });
  }

  // 获取排片座位信息
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  const seats: { [key: string]: SeatInfo } = JSON.parse(schedule.seats);
  const orderSeats: string[] = JSON.parse(order.seats);

  // 再次检查座位状态（防止并发问题）
  const unavailable = checkSeatsAvailable(order.schedule_id, orderSeats, id);
  if (unavailable) {
    return res.status(400).json({ 
      message: `座位 ${unavailable.seatId} ${unavailable.reason}` 
    });
  }

  const updateOrder = db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?");
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');

  const tx = db.transaction(() => {
    // 更新订单状态
    updateOrder.run(id);

    // 将座位标记为已售出
    for (const seatId of orderSeats) {
      if (seats[seatId]) {
        seats[seatId].sold = true;
      }
    }
    updateSeats.run(JSON.stringify(seats), order.schedule_id);
  });

  tx();

  res.json({
    message: '支付成功',
    order: {
      id: id,
      status: 'paid'
    }
  });
});

/**
 * 取消订单
 * 取消待支付订单，释放锁定的座位
 */
router.post('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // 获取订单信息
  let orderQuery = 'SELECT * FROM orders WHERE id = ?';
  const params: any[] = [id];
  
  if (userRole !== 'admin') {
    orderQuery += ' AND user_id = ?';
    params.push(userId);
  }

  const order = db.prepare(orderQuery).get(...params) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  // 只有待支付订单可以取消
  if (order.status !== 'pending') {
    return res.status(400).json({ message: '当前订单状态不支持取消' });
  }

  // 更新订单状态为已取消
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);

  res.json({
    message: '订单已取消，座位已释放'
  });
});

// 兼容旧接口：直接创建并支付订单（为了向后兼容）
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
  
  for (const seatId of seats) {
    if (!currentSeats[seatId] || !currentSeats[seatId].available || currentSeats[seatId].sold) {
      return res.status(400).json({ message: `座位 ${seatId} 不可用` });
    }
  }
  
  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();
  
  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'paid');
    
    for (const seatId of seats) {
      currentSeats[seatId].sold = true;
    }
    
    updateSeats.run(JSON.stringify(currentSeats), schedule_id);
  });
  
  tx();
  
  res.json({
    id: orderId,
    message: '购票成功',
    order: {
      id: orderId,
      total_price: totalPrice,
      seats: seats,
      schedule_id: schedule_id
    }
  });
});

router.put('/:id/status', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: '更新成功' });
});

export default router;
