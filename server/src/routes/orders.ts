import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 待支付订单超时时间（毫秒）：15分钟
// 超过此时间未支付的订单将被自动取消，座位释放回可用池
const ORDER_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * 释放某个用户在某场次的所有锁座
 * 遍历指定场次的所有座位，将 locked_by 等于指定用户的座位恢复为可选状态
 *
 * @param scheduleId - 场次ID
 * @param userId - 需要释放锁座的用户ID
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
 * 释放指定场次中指定座位的占用（将 sold 恢复为可用）
 * 用于订单取消时将已标记为 sold 的座位恢复为可选
 *
 * @param scheduleId - 场次ID
 * @param seatIds - 需要释放的座位ID列表
 */
function releaseSoldSeats(scheduleId: string, seatIds: string[]): void {
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule || !schedule.seats) return;

  const currentSeats = JSON.parse(schedule.seats);

  for (const seatId of seatIds) {
    if (currentSeats[seatId]) {
      currentSeats[seatId].sold = false;
      currentSeats[seatId].locked = false;
      currentSeats[seatId].locked_by = null;
      currentSeats[seatId].locked_until = null;
    }
  }

  db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(currentSeats), scheduleId);
}

/**
 * 清理超时未支付的订单（惰性清理 + 定时清理双重保障）
 *
 * 惰性清理：每次订单相关API调用时执行，确保查询到的订单状态是最新的
 * 定时清理：由 index.ts 中的 setInterval 定时触发
 *
 * 逻辑：
 * 1. 查询所有 status='pending' 且创建时间超过 ORDER_TIMEOUT_MS 的订单
 * 2. 将这些订单状态更新为 'cancelled'
 * 3. 将订单中占用的座位恢复为可用状态（sold → available）
 *
 * @returns 本次清理取消的订单数量
 */
export function cleanupExpiredOrders(): number {
  const timeoutThreshold = new Date(Date.now() - ORDER_TIMEOUT_MS).toISOString();

  // 查询所有超时的待支付订单
  const expiredOrders = db.prepare(
    'SELECT id, schedule_id, seats FROM orders WHERE status = ? AND created_at < ?'
  ).all('pending', timeoutThreshold) as any[];

  if (expiredOrders.length === 0) return 0;

  // 使用事务批量处理，保证原子性
  const updateOrderStatus = db.prepare('UPDATE orders SET status = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const order of expiredOrders) {
      // 1. 将订单状态更新为已取消
      updateOrderStatus.run('cancelled', order.id);

      // 2. 释放该订单占用的座位
      const orderSeats: string[] = JSON.parse(order.seats);
      releaseSoldSeats(order.schedule_id, orderSeats);
    }
  });

  tx();

  return expiredOrders.length;
}

/**
 * GET / - 获取订单列表
 * 普通用户只能查看自己的订单，管理员可查看所有订单
 * 每次查询前先清理超时订单，保证返回的数据状态是最新的
 */
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  // 惰性清理：查询前先清理超时订单
  cleanupExpiredOrders();

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

  // 将 seats 字段从 JSON 字符串解析为数组
  rows.forEach(row => {
    if (row.seats) {
      row.seats = JSON.parse(row.seats);
    }
  });

  res.json(rows);
});

/**
 * GET /:id - 获取订单详情
 * 查询前先清理超时订单，避免返回已超时但仍为 pending 的订单
 */
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  // 惰性清理：查询前先清理超时订单
  cleanupExpiredOrders();

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
 *
 * 防竞态条件设计：
 * 1. 先释放该用户在此场次的过期锁座（防止残留锁干扰）
 * 2. 重新读取最新座位数据，验证每个座位的状态：
 *    - 座位必须可用（available=true）且未售出（sold=false）
 *    - 座位必须被当前用户锁定（locked=true && locked_by=当前用户）
 *    - 如果座位未被锁定或被其他用户锁定，则拒绝创建
 * 3. 在事务中原子性地完成：创建订单 + 标记座位为已售 + 释放锁
 *
 * 这样即使锁在用户选座和创建订单之间过期，也不会出现座位被其他人占用的竞态问题，
 * 因为过期锁会被释放，此时座位不再属于当前用户，创建订单会失败。
 */
router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { schedule_id, seats } = req.body;

  if (!schedule_id || !seats || seats.length === 0) {
    return res.status(400).json({ message: '参数不完整' });
  }

  // 先清理超时订单，释放可能被超时订单占用的座位
  cleanupExpiredOrders();

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const currentSeats = JSON.parse(schedule.seats);

  // 防竞态：逐个验证座位状态
  for (const seatId of seats) {
    const seat = currentSeats[seatId];

    // 检查1：座位是否存在且可用
    if (!seat || !seat.available) {
      return res.status(400).json({ message: `座位 ${seatId} 不可用` });
    }

    // 检查2：座位是否已被售出（可能被其他已支付订单占用）
    if (seat.sold) {
      return res.status(400).json({ message: `座位 ${seatId} 已售出` });
    }

    // 检查3（防竞态核心）：座位必须被当前用户锁定
    // 如果锁已过期并被释放，locked 会变为 false，此处会拒绝创建
    // 如果锁被其他用户持有，locked_by 不匹配，也会拒绝创建
    if (!seat.locked || seat.locked_by !== userId) {
      return res.status(400).json({
        message: `座位 ${seatId} 锁定状态已失效，请返回重新选座`,
        code: 'LOCK_EXPIRED'
      });
    }
  }

  const totalPrice = schedule.price * seats.length;
  const orderId = uuidv4();

  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateSeats = db.prepare('UPDATE schedules SET seats = ? WHERE id = ?');

  // 使用事务保证原子性：创建订单 + 标记座位已售 + 释放锁，要么全部成功要么全部回滚
  const tx = db.transaction(() => {
    // 创建订单，初始状态为 pending（待支付）
    insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'pending');

    // 将座位标记为已售出，同时释放锁（因为已售出状态本身就能防止其他人选座）
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
 * 支付前先清理超时订单，如果订单已被自动取消则拒绝支付
 */
router.put('/:id/pay', authMiddleware, (req: AuthRequest, res) => {
  // 惰性清理：支付前先清理超时订单
  cleanupExpiredOrders();

  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

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

  // 订单可能已被超时自动取消，此时状态不再是 pending
  if (order.status === 'cancelled') {
    return res.status(400).json({ message: '订单已超时取消，请重新选座购票' });
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
 * 仅允许取消 pending 状态的订单
 * 取消后释放订单中占用的座位（sold → available），其他用户可重新选择
 */
router.put('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

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

  // 释放订单占用的座位
  const orderSeats: string[] = JSON.parse(order.seats);
  releaseSoldSeats(order.schedule_id, orderSeats);

  // 更新订单状态为已取消
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', id);

  res.json({ message: '订单已取消，座位已释放' });
});

/**
 * PUT /:id/status - 更新订单状态（管理员专用）
 * 管理员可手动将订单状态变更为任意合法状态
 */
router.put('/:id/status', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

  res.json({ message: '更新成功' });
});

export default router;
