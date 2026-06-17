import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', (req, res) => {
  const { status, limit, offset } = req.query;
  let query = 'SELECT * FROM movies';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit as string));
  }
  
  if (offset) {
    query += ' OFFSET ?';
    params.push(parseInt(offset as string));
  }

  const movies = db.prepare(query).all(...params);
  res.json(movies);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  if (!movie) {
    return res.status(404).json({ message: '电影不存在' });
  }
  res.json(movie);
});

router.get('/:id/schedules', (req, res) => {
  const { id } = req.params;
  const { date, cinema_id } = req.query;
  
  let query = `
    SELECT s.*, c.name as cinema_name, c.address, c.district, c.city
    FROM schedules s
    JOIN cinemas c ON s.cinema_id = c.id
    WHERE s.movie_id = ?
  `;
  const params: any[] = [id];
  
  if (date) {
    query += ' AND DATE(s.start_time) = ?';
    params.push(date);
  }
  
  if (cinema_id) {
    query += ' AND s.cinema_id = ?';
    params.push(cinema_id);
  }
  
  query += ' ORDER BY s.start_time ASC';

  const rows = db.prepare(query).all(...params) as any[];
  
  const grouped: { [key: string]: any[] } = {};
  rows.forEach(row => {
    if (!grouped[row.cinema_id]) {
      grouped[row.cinema_id] = [];
    }
    grouped[row.cinema_id].push(row);
  });
  
  res.json(Object.keys(grouped).map(cinemaId => ({
    cinema_id: cinemaId,
    cinema_name: rows.find(r => r.cinema_id === cinemaId)?.cinema_name,
    address: rows.find(r => r.cinema_id === cinemaId)?.address,
    district: rows.find(r => r.cinema_id === cinemaId)?.district,
    schedules: grouped[cinemaId]
  })));
});

router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { title, poster, description, duration, rating, release_date, genre, director, cast, status } = req.body;
  const id = uuidv4();
  
  db.prepare(
    'INSERT INTO movies (id, title, poster, description, duration, rating, release_date, genre, director, cast, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, poster, description, duration, rating, release_date, genre, director, cast, status || 'showing');
  
  res.json({ id, message: '添加成功' });
});

router.put('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { title, poster, description, duration, rating, release_date, genre, director, cast, status } = req.body;
  
  db.prepare(
    'UPDATE movies SET title = ?, poster = ?, description = ?, duration = ?, rating = ?, release_date = ?, genre = ?, director = ?, cast = ?, status = ? WHERE id = ?'
  ).run(title, poster, description, duration, rating, release_date, genre, director, cast, status, id);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM movies WHERE id = ?').run(id);
  
  res.json({ message: '删除成功' });
});

export default router;
