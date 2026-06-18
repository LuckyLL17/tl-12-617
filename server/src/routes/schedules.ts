import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 锁座超时时间（毫秒）：10分钟
// 用户锁定座位后，若10分钟内未完成支付，锁自动失效，座位恢复为可选
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 释放指定场次中所有已过期的锁座
 *
 * 遍历某个场次的所有座位，检查每个被锁定的座位：
 * - 如果当前时间已超过 locked_until 时间，则将该座位恢复为可选状态
 * - 释放后清除 locked_by 和 locked_until 字段
 *
 * 此函数在以下场景被调用：
 * 1. 获取排片详情时（GET /:id）- 确保返回的座位状态是最新的
 * 2. 推荐座位时（POST /:id/recommend）- 确保推荐结果基于最新可用座位
 * 3. 锁定座位时（POST /:id/lock）- 避免过期锁影响新锁座操作
 *
 * @param scheduleId - 需要清理过期锁的场次ID
 */
function releaseExpiredLocks(scheduleId: string): void {
  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(scheduleId) as any;
  if (!schedule || !schedule.seats) return;

  const seats = JSON.parse(schedule.seats);
  const now = new Date().toISOString();
  let changed = false;

  for (const seatId of Object.keys(seats)) {
    const seat = seats[seatId];
    // 判断条件：座位被锁 且 锁定截止时间已过
    if (seat.locked && seat.locked_until && new Date(seat.locked_until) <= new Date(now)) {
      seat.locked = false;
      seat.locked_by = null;
      seat.locked_until = null;
      changed = true;
    }
  }

  // 仅在有变更时才写回数据库，减少不必要的IO
  if (changed) {
    db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), scheduleId);
  }
}

/**
 * 释放指定用户在某场次的所有锁座
 *
 * 当用户主动取消选座、重新选座或订单取消时调用，
 * 将该用户在此场次锁定的所有座位恢复为可选状态。
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
 * GET / - 获取排片列表
 *
 * 支持按电影ID、影院ID、日期进行筛选
 * 返回结果按开场时间升序排列
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
 *
 * 获取前先释放过期锁座，确保返回的座位状态是最新的
 * 座位数据以对象形式返回，key为座位号（如"A1"），value包含：
 * - available: 是否可用
 * - sold: 是否已售
 * - locked: 是否被锁
 * - locked_by: 锁定者用户ID
 * - locked_until: 锁定过期时间
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
 *
 * 推荐策略（按优先级）：
 * 1. 策略1 - 同行连续：在同一行中寻找连续的可用座位
 *    从第1行开始逐行扫描，找到第一组满足数量的连续座位即返回
 *    这种推荐方式保证同行观影体验最佳
 *
 * 2. 策略2 - 距离优先：若找不到完全连续的座位，按距离银幕中央的曼哈顿距离排序
 *    银幕中央约在第4-5行、第5-7列位置
 *    选择距离中央最近的可用座位组合，保证观影效果
 *
 * @param count - 推荐座位数量（1-6）
 * @returns recommended - 推荐的座位ID数组，若不足则返回空数组
 */
router.post('/:id/recommend', (req, res) => {
  const { id } = req.params;
  const { count } = req.body;

  if (!count || count < 1 || count > 6) {
    return res.status(400).json({ message: '推荐人数需在1-6之间' });
  }

  // 先释放过期锁座，确保推荐基于最新可用座位
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

  // 策略2：按距离银幕中央的曼哈顿距离排序，选择最近的可用座位
  const centerRow = 4;  // 银幕中央行（0-indexed）
  const centerCol = 6;  // 银幕中央列（0-indexed，对应第7列）
  const availableSeats: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      if (isSeatAvailable(seatId)) {
        availableSeats.push(seatId);
      }
    }
  }

  // 曼哈顿距离排序：|行差| + |列差|
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

  // 可用座位不足，返回空数组
  return res.json({ recommended: [], message: '可用座位不足' });
});

/**
 * POST /:id/lock - 锁定座位
 *
 * 用户选好座位后调用此接口进行锁定，防止其他用户同时选择同一座位。
 *
 * 锁座机制：
 * 1. 先释放该用户在此场次的旧锁座（同一用户同一场次只能有一组锁座）
 * 2. 释放所有已过期的锁座
 * 3. 验证所有目标座位是否可选（未被售出、未被其他用户锁定）
 * 4. 执行锁座，设置 locked_by 和 locked_until
 *
 * 锁座有效期：LOCK_TIMEOUT_MS（10分钟）
 * 超时后锁自动失效，座位恢复为可选（由 releaseExpiredLocks 处理）
 *
 * @param seats - 要锁定的座位ID数组
 * @returns locked_until - 锁定过期时间（ISO格式）
 */
router.post('/:id/lock', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const { seats: seatIds } = req.body;

  if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ message: '请选择要锁定的座位' });
  }

  // 先释放该用户在此场次之前的锁座（同一用户同一场次只保留最新一组锁）
  releaseUserLocks(id, userId!);
  // 释放所有过期锁座
  releaseExpiredLocks(id);

  const schedule = db.prepare('SELECT seats FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);

  // 验证所有目标座位是否可选
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

  // 执行锁座：标记锁定状态、锁定者、过期时间
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
 *
 * 用户主动取消选座时调用，释放该用户在此场次的所有锁座
 * 使座位恢复为可选状态，其他用户可以重新选择
 */
router.delete('/:id/lock', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  releaseUserLocks(id, userId!);

  res.json({ message: '解锁成功' });
});

/**
 * POST / - 创建排片（管理员专用）
 *
 * 创建新的排片记录，同时初始化座位图：
 * - 8行 × 12列 = 96个座位
 * - 座位编号规则：行号(A-H) + 列号(1-12)，如 A1、B5、H12
 * - 初始状态：所有座位 available=true, sold=false, locked=false
 */
router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  const id = uuidv4();

  const rows = 8;
  const cols = 12;
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
 * PUT /:id - 更新排片信息（管理员专用）
 * 仅更新排片的基本信息，不影响座位状态
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
 * DELETE /:id - 删除排片（管理员专用）
 * 删除排片记录，关联的订单数据不受影响
 */
router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;

  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

  res.json({ message: '删除成功' });
});

export default router;
