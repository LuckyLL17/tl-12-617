import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * 释放某个用户在某场次的所有锁座
 * 用于订单取消时释放座位
 */
function releaseUserLocks(scheduleId: string, userId: string): void {
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule || !schedule.seats) return;

  const seats = JSON.parse(schedule.seats);
  let changed = false;

  for (const seatId of Object.keys(seats)) {
    const seat = seats[seatId];
    if (seat.locked && seat.locked_by === userId) {
      seat.locked = false;
      seat.locked_by = null;
      seat.locked_until = null;
      changed = true;
    }
  }

  if (changed) {
    db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), scheduleId);
  }
}

/**
 * GET / - 获取订单列表
 * 普通用户只能查看自己的订单，管理员可查看所有
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
 * GET /:id - 获取订单详情
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
 * POST / - 创建订单
 * 订单初始状态为 pending（待支付），座位标记为已售出并释放锁
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
  
  // 检查座位是否可用（已被当前用户锁定的座位也可以使用）
  for (const seatId of seats) {
    if (!currentSeats[seatId] || !currentSeats[seatId].available || currentSeats[seatId].sold) {
      return res.status(400).json({ message: `座位 ${seatId} 不可用` });
    }
    // 如果座位被其他用户锁定，也不可用
    if (currentSeats[seatId].locked && currentSeats[seatId].locked_by !== userId) {
      return res.status(400).json({ message: `座位 ${seatId} 已被其他用户锁定` });
    }
  }
  
  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();
  
  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 创建订单，状态为 pending（待支付）
    insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'pending');
    
    // 将座位标记为已售出，同时释放锁
    for (const seatId of seats) {
      currentSeats[seatId].sold = true;
      currentSeats[seatId].locked = false;
      currentSeats[seatId].locked_by = null;
      currentSeats[seatId].locked_until = null;
    }
    
    updateSeats.run(JSON.stringify(currentSeats), schedule_id);
  });
  
  tx();
  
  res.json({
    id: orderId,
    message: '订单创建成功，请尽快完成支付',
    order: {
      id: orderId,
      total_price: totalPrice,
      seats: seats,
      schedule_id: schedule_id,
      status: 'pending'
    }
  });
});

/**
 * PUT /:id/pay - 支付订单
 * 将订单状态从 pending 更新为 paid
 */
router.put('/:id/pay', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // 查询订单
  let query = 'SELECT * FROM orders WHERE id = ?';
  const params: any[] = [id];
  if (userRole !== 'admin') {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const order = db.prepare(query).get(...params) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ message: '订单状态不允许支付' });
  }

  // 更新订单状态为已支付
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', id);

  res.json({ message: '支付成功', id });
});

/**
 * PUT /:id/cancel - 取消订单
 * 仅允许取消 pending 状态的订单，取消后释放锁定的座位
 */
router.put('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  // 查询订单
  let query = 'SELECT * FROM orders WHERE id = ?';
  const params: any[] = [id];
  if (userRole !== 'admin') {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const order = db.prepare(query).get(...params) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ message: '仅待支付订单可取消' });
  }

  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  if (schedule && schedule.seats) {
    const currentSeats = JSON.parse(schedule.seats);
    const orderSeats: string[] = JSON.parse(order.seats);

    // 将订单中的座位恢复为可用状态
    for (const seatId of orderSeats) {
      if (currentSeats[seatId]) {
        currentSeats[seatId].sold = false;
        currentSeats[seatId].locked = false;
        currentSeats[seatId].locked_by = null;
        currentSeats[seatId].locked_until = null;
      }
    }

    db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(currentSeats), order.schedule_id);
  }

  // 更新订单状态为已取消
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', id);

  res.json({ message: '订单已取消，座位已释放' });
});

/**
 * PUT /:id/status - 更新订单状态（管理员）
 */
router.put('/:id/status', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: '更新成功' });
});

export default router;
