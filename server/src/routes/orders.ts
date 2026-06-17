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
