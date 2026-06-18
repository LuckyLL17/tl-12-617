import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

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

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
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
    const seats = JSON.parse(row.seats);
    const now = new Date();
    let needUpdate = false;
    
    // 清理过期的锁座（超过锁定时间的座位自动释放
    for (const seatId of Object.keys(seats)) {
      const seat = seats[seatId];
      if (seat.locked && seat.locked_until && new Date(seat.locked_until) < now) {
        seat.locked = false;
        seat.locked_by = null;
        seat.locked_until = null;
        needUpdate = true;
      }
    }
    
    // 如果有过期锁座被释放，更新数据库
    if (needUpdate) {
      db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), id);
    }
    
    row.seats = seats;
  }
  res.json(row);
});

router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  const id = uuidv4();
  
  const rows = 8;
  const cols = 12;
  // 座位结构包含：是否可用、是否已售、是否锁定、锁定用户、锁定过期时间
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

router.put('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  
  db.prepare(
    'UPDATE schedules SET movie_id = ?, cinema_id = ?, start_time = ?, end_time = ?, hall = ?, price = ? WHERE id = ?'
  ).run(movie_id, cinema_id, start_time, end_time, hall, price, id);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  
  res.json({ message: '删除成功' });
});

/**
 * 锁定座位接口
 * 请求体: { seats: string[] }
 * 锁定时间: 15分钟
 */
router.post('/:id/lock-seats', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const { seats: seatIds } = req.body;

  if (!seatIds || seatIds.length === 0) {
    return res.status(400).json({ message: '请选择座位' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);
  const now = new Date();
  const lockDuration = 15 * 60 * 1000; // 锁定15分钟
  const lockUntil = new Date(now.getTime() + lockDuration);

  const tx = db.transaction(() => {
    // 检查所有座位是否可锁定
    for (const seatId of seatIds) {
      const seat = seats[seatId];
      if (!seat || !seat.available) {
        throw new Error(`座位 ${seatId} 不存在`);
      }
      if (seat.sold) {
        throw new Error(`座位 ${seatId} 已售出`);
      }
      // 如果座位被锁定，检查是否是当前用户锁定的，或者是否已过期
      if (seat.locked && seat.locked_by !== userId) {
        if (seat.locked_until && new Date(seat.locked_until) > now) {
          throw new Error(`座位 ${seatId} 已被其他用户锁定`);
        }
      }
    }

    // 执行锁定
    for (const seatId of seatIds) {
      seats[seatId].locked = true;
      seats[seatId].locked_by = userId;
      seats[seatId].locked_until = lockUntil.toISOString();
    }

    db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), id);
  });

  try {
    tx();
    res.json({
      message: '座位锁定成功',
      locked_until: lockUntil.toISOString(),
      seats: seatIds
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * 解锁座位接口
 * 请求体: { seats: string[] }
 * 只能解锁当前用户锁定的座位
 */
router.post('/:id/unlock-seats', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const { seats: seatIds } = req.body;

  if (!seatIds || seatIds.length === 0) {
    return res.status(400).json({ message: '请选择座位' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);

  // 解锁座位
  for (const seatId of seatIds) {
    const seat = seats[seatId];
    if (seat && seat.locked && seat.locked_by === userId) {
      seat.locked = false;
      seat.locked_by = null;
      seat.locked_until = null;
    }
  }

  db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(JSON.stringify(seats), id);

  res.json({ message: '座位解锁成功' });
});

/**
 * 推荐座位接口
 * 查询参数: count=座位数量
 * 推荐策略: 优先中间区域、连座、视野最佳位置
 */
router.get('/:id/recommend-seats', (req, res) => {
  const { id } = req.params;
  const count = parseInt(req.query.count as string, 10) || 1;

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }

  const seats = JSON.parse(schedule.seats);
  const rows = 8;
  const cols = 12;
  const now = new Date();

  // 构建座位矩阵
  const seatMatrix: (string | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      const seat = seats[seatId];
      // 可选座位条件：可用、未售、未锁定（或锁定已过期）
      if (seat && seat.available && !seat.sold && (!seat.locked || !seat.locked_until || new Date(seat.locked_until) < now)) {
        row.push(seatId);
      } else {
        row.push(null);
      }
    }
    seatMatrix.push(row);
  }

  // 推荐座位优先级：中间行 > 前排 > 后排，中间列 > 两边
  const rowPriority = [3, 4, 2, 5, 1, 6, 0, 7]; // 第4、5行最优（索引3、4）
  let bestSeats: string[] = [];
  let bestScore = -Infinity;

  // 遍历每行，寻找连续的count个座位
  for (const rowIdx of rowPriority) {
    const row = seatMatrix[rowIdx];
    for (let col = 0; col <= cols - count; col++) {
      let allAvailable = true;
      const currentSeats: string[] = [];

      for (let i = 0; i < count; i++) {
        if (row[col + i] === null) {
          allAvailable = false;
          break;
        }
        currentSeats.push(row[col + i]!);
      }

      if (allAvailable) {
        // 计算座位得分：越靠中间分数越高
        const centerCol = (cols - 1) / 2;
        const seatCenterCol = col + (count - 1) / 2;
        const colDistance = Math.abs(seatCenterCol - centerCol);
        const rowScore = rows - rowPriority.indexOf(rowIdx);
        const colScore = cols - colDistance;
        const score = rowScore * 10 + colScore;

        if (score > bestScore) {
          bestScore = score;
          bestSeats = currentSeats;
        }
      }
    }
  }

  // 如果找不到连座，返回分散的最优座位
  if (bestSeats.length === 0) {
    const allAvailableSeats: { seatId: string; score: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatId = seatMatrix[r][c];
        if (seatId) {
          const centerCol = (cols - 1) / 2;
          const colDistance = Math.abs(c - centerCol);
          const rowDistance = Math.abs(r - 3.5); // 中间行
          const score = (rows - rowDistance) * 10 + (cols - colDistance);
          allAvailableSeats.push({ seatId, score });
        }
      }
    }

    // 按得分排序，取前count个
    allAvailableSeats.sort((a, b) => b.score - a.score);
    bestSeats = allAvailableSeats.slice(0, Math.min(count, allAvailableSeats.length)).map(s => s.seatId);
  }

  res.json({
    recommended_seats: bestSeats,
    count: bestSeats.length
  });
});

export default router;
