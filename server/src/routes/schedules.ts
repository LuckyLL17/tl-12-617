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
    row.seats = JSON.parse(row.seats);
  }
  res.json(row);
});

/**
 * 创建排片接口
 * 初始化座位数据，包含available、sold、locked、locked_order_id四个状态
 */
router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { movie_id, cinema_id, start_time, end_time, hall, price } = req.body;
  const id = uuidv4();
  
  const rows = 8;
  const cols = 12;
  const seats: { [key: string]: { available: boolean; sold: boolean; locked: boolean; locked_order_id: string | null } } = {};
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
      seats[seatId] = { 
        available: true, 
        sold: false,
        locked: false,
        locked_order_id: null
      };
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
