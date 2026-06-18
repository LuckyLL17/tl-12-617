import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

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
 * 创建订单接口
 * 订单状态为 pending（待支付），座位被锁定
 * 支付成功后调用支付接口将状态改为 paid
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
  const now = new Date();
  
  // 检查座位是否可用
  for (const seatId of seats) {
    const seat = currentSeats[seatId];
    if (!seat || !seat.available) {
      return res.status(400).json({ message: `座位 ${seatId} 不存在` });
    }
    if (seat.sold) {
      return res.status(400).json({ message: `座位 ${seatId} 已售出` });
    }
    // 检查是否被其他用户锁定
    if (seat.locked && seat.locked_by !== userId) {
      if (seat.locked_until && new Date(seat.locked_until) > now) {
        return res.status(400).json({ message: `座位 ${seatId} 已被其他用户锁定，请选择其他座位` });
      }
    }
  }
  
  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();
  const lockDuration = 15 * 60 * 1000; // 锁定15分钟
  const lockUntil = new Date(now.getTime() + lockDuration);
  
  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 创建待支付订单
    insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'pending');
    
    // 锁定座位
    for (const seatId of seats) {
      currentSeats[seatId].locked = true;
      currentSeats[seatId].locked_by = userId;
      currentSeats[seatId].locked_until = lockUntil.toISOString();
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
      status: 'pending',
      locked_until: lockUntil.toISOString()
    }
  });
});

/**
 * 订单支付接口
 * 将订单状态从 pending 改为 paid，座位从锁定改为已售
 */
router.post('/:id/pay', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }
  
  if (order.status !== 'pending') {
    return res.status(400).json({ message: '订单状态不正确，无法支付' });
  }
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const seats = JSON.parse(schedule.seats);
  const orderSeats = JSON.parse(order.seats);
  const now = new Date();
  
  // 检查座位锁定是否过期
  for (const seatId of orderSeats) {
    const seat = seats[seatId];
    if (!seat || !seat.locked || seat.locked_by !== userId) {
      return res.status(400).json({ message: `座位 ${seatId} 锁定已失效，请重新选择座位` });
    }
    if (seat.locked_until && new Date(seat.locked_until) < now) {
      return res.status(400).json({ message: '座位锁定已过期，请重新选择座位' });
    }
  }
  
  const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 更新订单状态为已支付
    updateOrder.run('paid', id);
    
    // 将座位从锁定改为已售
    for (const seatId of orderSeats) {
      seats[seatId].sold = true;
      seats[seatId].locked = false;
      seats[seatId].locked_by = null;
      seats[seatId].locked_until = null;
    }
    
    updateSeats.run(JSON.stringify(seats), order.schedule_id);
  });
  
  tx();
  
  res.json({ message: '支付成功', order_id: id });
});

/**
 * 取消订单接口
 * 取消待支付订单，释放锁定的座位
 */
router.post('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  
  let order;
  if (userRole === 'admin') {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  } else {
    order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, userId) as any;
  }
  
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }
  
  if (order.status !== 'pending') {
    return res.status(400).json({ message: '只能取消待支付的订单' });
  }
  
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(order.schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  const seats = JSON.parse(schedule.seats);
  const orderSeats = JSON.parse(order.seats);
  
  const updateOrder = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');
  
  const tx = db.transaction(() => {
    // 更新订单状态为已取消
    updateOrder.run('cancelled', id);
    
    // 释放锁定的座位
    for (const seatId of orderSeats) {
      const seat = seats[seatId];
      if (seat && seat.locked && seat.locked_by === userId) {
        seat.locked = false;
        seat.locked_by = null;
        seat.locked_until = null;
      }
    }
    
    updateSeats.run(JSON.stringify(seats), order.schedule_id);
  });
  
  tx();
  
  res.json({ message: '订单已取消，座位已释放' });
});

router.put('/:id/status', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  
  res.json({ message: '更新成功' });
});

export default router;
