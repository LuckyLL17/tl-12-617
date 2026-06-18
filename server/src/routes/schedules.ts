import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * 座位信息类型定义
 */
interface SeatInfo {
  available: boolean;
  sold: boolean;
  locked?: boolean;
  locked_by?: string;
}

/**
 * 合并座位锁定状态
 * 从订单表中查询 pending 状态且未超时的订单，将对应座位标记为锁定
 * @param scheduleId 排片ID
 * @param seats 原始座位数据
 * @returns 合并了锁定状态的座位数据
 */
function mergeLockedSeats(scheduleId: string, seats: { [key: string]: SeatInfo }): { [key: string]: SeatInfo } {
  // 查询当前排片所有待支付且未超时的订单
  const lockedOrders = db.prepare(`
    SELECT id, seats 
    FROM orders 
    WHERE schedule_id = ? 
      AND status = 'pending' 
      AND locked_until > datetime('now')
  `).all(scheduleId) as Array<{ id: string; seats: string }>;

  // 深拷贝座位数据，避免修改原始数据
  const result: { [key: string]: SeatInfo } = {};
  for (const seatId in seats) {
    result[seatId] = { ...seats[seatId] };
  }

  // 遍历所有锁定订单，标记锁定座位
  for (const order of lockedOrders) {
    const orderSeats: string[] = JSON.parse(order.seats);
    for (const seatId of orderSeats) {
      if (result[seatId]) {
        result[seatId].locked = true;
        result[seatId].locked_by = order.id;
      }
    }
  }

  return result;
}

/**
 * 推荐最佳座位算法
 * 策略：
 * 1. 优先选择中间区域（银幕中央位置体验最佳）
 * 2. 优先选择连续座位
 * 3. 从中间向两边、从中间排向前后搜索
 * @param seats 座位数据
 * @param count 需要的座位数量
 * @param rows 总行数
 * @param cols 总列数
 * @returns 推荐的座位ID数组，若无合适座位返回空数组
 */
function recommendSeats(
  seats: { [key: string]: SeatInfo },
  count: number,
  rows: number = 8,
  cols: number = 12
): string[] {
  // 座位是否可用：未售出、未锁定、物理存在
  const isAvailable = (seatId: string): boolean => {
    const seat = seats[seatId];
    return seat && seat.available && !seat.sold && !seat.locked;
  };

  // 获取座位的优先级分数（越小越好）
  // 基于行和列距离中心的距离计算
  const getPriority = (row: number, col: number): number => {
    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    // 行权重：中间排体验最好，权重稍高
    const rowDist = Math.abs(row - centerRow) * 1.2;
    const colDist = Math.abs(col - centerCol);
    return rowDist + colDist;
  };

  // 生成所有可能的连续座位组合
  const candidates: Array<{ seats: string[]; priority: number }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - count; c++) {
      // 检查从第c列开始的count个座位是否连续可用
      let allAvailable = true;
      const seatIds: string[] = [];
      
      for (let i = 0; i < count; i++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + i + 1}`;
        seatIds.push(seatId);
        if (!isAvailable(seatId)) {
          allAvailable = false;
          break;
        }
      }

      if (allAvailable) {
        // 计算这组座位的平均优先级
        const avgPriority = getPriority(r, c + (count - 1) / 2);
        candidates.push({
          seats: seatIds,
          priority: avgPriority
        });
      }
    }
  }

  // 如果没有找到连续座位，尝试找不连续的（分散的）最佳座位
  if (candidates.length === 0) {
    // 收集所有可用座位并按优先级排序
    const allAvailableSeats: Array<{ seatId: string; priority: number }> = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
        if (isAvailable(seatId)) {
          allAvailableSeats.push({
            seatId,
            priority: getPriority(r, c)
          });
        }
      }
    }

    // 按优先级排序，取前count个
    allAvailableSeats.sort((a, b) => a.priority - b.priority);
    
    if (allAvailableSeats.length >= count) {
      return allAvailableSeats.slice(0, count).map(s => s.seatId);
    }
    
    return [];
  }

  // 按优先级排序，返回最佳的一组
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].seats;
}

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
 * 获取排片详情（包含座位锁定状态）
 */
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
    // 合并锁定状态
    row.seats = mergeLockedSeats(id, seats);
  }
  res.json(row);
});

/**
 * 座位推荐接口
 * 根据指定的票数推荐最佳座位
 */
router.get('/:id/recommend', (req, res) => {
  const { id } = req.params;
  const { count } = req.query;
  
  const seatCount = parseInt(count as string, 10) || 1;
  
  if (seatCount < 1 || seatCount > 10) {
    return res.status(400).json({ message: '座位数量必须在1-10之间' });
  }
  
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
  
  if (!row) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  let seats: { [key: string]: SeatInfo } = {};
  if (row.seats) {
    seats = JSON.parse(row.seats);
    // 合并锁定状态
    seats = mergeLockedSeats(id, seats);
  }
  
  const recommended = recommendSeats(seats, seatCount);
  
  if (recommended.length === 0) {
    return res.status(400).json({ message: '没有足够的可用座位' });
  }
  
  res.json({
    seats: recommended,
    message: `已为您推荐${seatCount}个最佳座位`
  });
});

router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  const id = uuidv4();
  
  const rows = 8;
  const cols = 12;
  const seats: { [key: string]: { available: boolean; sold: boolean } } = {};
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      seats[seatId] = { available: true, sold: false };
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

export default router;
