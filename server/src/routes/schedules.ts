import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 锁座超时时间（毫秒）：10分钟
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 释放已过期的锁座
 * 遍历某个场次的所有座位，将超过锁定时间的座位恢复为可用状态
 */
function releaseExpiredLocks(scheduleId: string): void {
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule || !schedule.seats) return;

  const seats = JSON.parse(schedule.seats);
  const now = new Date().toISOString();
  let changed = false;

  for (const seatId of Object.keys(seats)) {
    const seat = seats[seatId];
    // 如果座位被锁且锁定时间已过期，释放锁
    if (seat.locked && seat.locked_until && new Date(seat.locked_until) <= new Date(now)) {
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
 * 释放某个用户在某场次的所有锁座
 * 用于用户取消选座或订单取消时释放座位
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
 * GET / - 获取排片列表
 * 支持按电影、影院、日期筛选
 */
router.get('/', (req, res) => {
  const { movie_id, cinema_id, date } = req.query;
  let query = `
    SELECT s.*, m.title as movie_title, c.name as cinema_name
    FROM schedules s
    JOIN movies m ON s.movie_id = m.id
    JOIN cinemas c ON s.cinema_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (movie_id) {
    query += ' AND s.movie_id = ?';
    params.push(movie_id);
  }
  if (cinema_id) {
    query += ' AND s.cinema_id = ?';
    params.push(cinema_id);
  }
  if (date) {
    query += ' AND DATE(s.start_time) = ?';
    params.push(date);
  }
  
  query += ' ORDER BY s.start_time ASC';

  const schedules = db.prepare(query).all(...params);
  res.json(schedules);
});

/**
 * GET /:id - 获取排片详情（含座位信息）
 * 获取前先释放过期锁座，确保座位状态最新
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  // 释放过期锁座，保证返回的座位状态是最新的
  releaseExpiredLocks(id);
  
  const row = db.prepare(`
    SELECT s.*, m.title as movie_title, m.poster, m.duration, c.name as cinema_name, c.address
    FROM schedules s
    JOIN movies m ON s.movie_id = m.id
    JOIN cinemas c ON s.cinema_id = c.id
    WHERE s.id = ?
  `).get(id) as any;
  
  if (!row) {
    return res.status(404).json({ message: '排片不存在' });
  }
  if (row.seats) {
    row.seats = JSON.parse(row.seats);
  }
  res.json(row);
});

/**
 * POST /:id/recommend - 根据人数推荐相邻座位
 * 优先推荐同一行中连续的座位，其次推荐距离银幕中央最近的座位
 */
router.post('/:id/recommend', (req, res) => {
  const { id } = req.params;
  const { count } = req.body;

  if (!count || count < 1 || count > 6) {
    return res.status(400).json({ message: '推荐人数需在1-6之间' });
  }

  // 先释放过期锁座
  releaseExpiredLocks(id);

  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);
  const rows = 8;
  const cols = 12;

  // 判断座位是否可选（未被售出且未被锁定）
  const isSeatAvailable = (seatId: string): boolean => {
    const seat = seats[seatId];
    return seat && seat.available && !seat.sold && !seat.locked;
  };

  // 策略1：在同一行中寻找连续的可用座位
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - count; c++) {
      const candidateSeats: string[] = [];
      let allAvailable = true;

      for (let offset = 0; offset < count; offset++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + 1 + offset}`;
        if (isSeatAvailable(seatId)) {
          candidateSeats.push(seatId);
        } else {
          allAvailable = false;
          break;
        }
      }

      if (allAvailable && candidateSeats.length === count) {
        return res.json({ recommended: candidateSeats });
      }
    }
  }

  // 策略2：如果找不到完全连续的座位，寻找距离银幕中央最近的可用座位组合
  // 银幕中央大约在第4-5行、第5-7列位置
  const centerRow = 4;
  const centerCol = 6;
  const availableSeats: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      if (isSeatAvailable(seatId)) {
        availableSeats.push(seatId);
      }
    }
  }

  // 按距离银幕中央的距离排序
  availableSeats.sort((a, b) => {
    const rowA = a.charCodeAt(0) - 65;
    const colA = parseInt(a.slice(1)) - 1;
    const rowB = b.charCodeAt(0) - 65;
    const colB = parseInt(b.slice(1)) - 1;

    const distA = Math.abs(rowA - centerRow) + Math.abs(colA - centerCol);
    const distB = Math.abs(rowB - centerRow) + Math.abs(colB - centerCol);

    return distA - distB;
  });

  if (availableSeats.length >= count) {
    return res.json({ recommended: availableSeats.slice(0, count) });
  }

  // 可用座位不足
  return res.json({ recommended: [], message: '可用座位不足' });
});

/**
 * POST /:id/lock - 锁定座位
 * 用户选座后锁定，防止其他用户同时选择同一座位
 * 锁定有效期为10分钟，超时自动释放
 */
router.post('/:id/lock', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const { seats: seatIds } = req.body;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ message: '请选择要锁定的座位' });
  }

  // 先释放该用户在此场次之前的锁座
  releaseUserLocks(id, userId!);
  // 释放过期锁座
  releaseExpiredLocks(id);

  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);

  // 检查所有座位是否可选
  for (const seatId of seatIds) {
    const seat = seats[seatId];
    if (!seat || !seat.available || seat.sold) {
      return res.status(400).json({ message: `座位 ${seatId} 已售出，无法锁定` });
    }
    if (seat.locked && seat.locked_by !== userId) {
      return res.status(400).json({ message: `座位 ${seatId} 已被其他用户锁定` });
    }
  }

  // 计算锁座过期时间
  const lockedUntil = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();

  // 执行锁座
  for (const seatId of seatIds) {
    seats[seatId].locked = true;
    seats[seatId].locked_by = userId;
    seats[seatId].locked_until = lockedUntil;
  }

  db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), id);

  res.json({ message: '锁座成功', locked_until: lockedUntil });
});

/**
 * DELETE /:id/lock - 解锁座位
 * 用户取消选座时调用，释放该用户在此场次的所有锁座
 */
router.delete('/:id/lock', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  releaseUserLocks(id, userId!);

  res.json({ message: '解锁成功' });
});

/**
 * POST / - 创建排片（管理员）
 */
router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  const id = uuidv4();
  
  const rows = 8;
  const cols = 12;
  // 座位模型包含锁定状态字段
  const seats: { [key: string]: { available: boolean; sold: boolean; locked: boolean; locked_by: string | null; locked_until: string | null } } = {};
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      seats[seatId] = { available: true, sold: false, locked: false, locked_by: null, locked_until: null };
    }
  }
  
  db.prepare(
    'INSERT INTO schedules (id, movie_id, cinema_id, start_time, end_time, hall, price, seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, movie_id, cinema_id, start_time, end_time, hall, price, JSON.stringify(seats));
  
  res.json({ id, message: '添加成功' });
});

/**
 * PUT /:id - 更新排片（管理员）
 */
router.put('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  
  db.prepare(
    'UPDATE schedules SET movie_id = ?, cinema_id = ?, start_time = ?, end_time = ?, hall = ?, price = ? WHERE id = ?'
  ).run(movie_id, cinema_id, start_time, end_time, hall, price, id);
  
  res.json({ message: '更新成功' });
});

/**
 * DELETE /:id - 删除排片（管理员）
 */
router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  
  res.json({ message: '删除成功' });
});

export default router;
