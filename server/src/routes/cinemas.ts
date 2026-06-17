import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', (req, res) => {
  const { city, district } = req.query;
  let query = 'SELECT * FROM cinemas';
  const params: any[] = [];
  
  const conditions: string[] = [];
  if (city) {
    conditions.push('city = ?');
    params.push(city);
  }
  if (district) {
    conditions.push('district = ?');
    params.push(district);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY created_at DESC';

  const cinemas = db.prepare(query).all(...params);
  res.json(cinemas);
});

function getPinyinInitial(char: string): string {
  const pinyinMap: { [key: string]: string } = {
    '北': 'B', '重': 'C', '广': 'G', '杭': 'H', '南': 'N',
    '上': 'S', '成': 'C', '西': 'X', '武': 'W', '郑': 'Z',
    '大': 'D', '青': 'Q', '福': 'F', '江': 'J'
  };
  return pinyinMap[char] || char.charAt(0).toUpperCase();
}

router.get('/cities', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT city, district FROM cinemas ORDER BY city, district').all() as any[];
  
  const cities: { [key: string]: string[] } = {};
  rows.forEach((row: any) => {
    if (!cities[row.city]) {
      cities[row.city] = [];
    }
    if (!cities[row.city].includes(row.district)) {
      cities[row.city].push(row.district);
    }
  });
  
  const cityList = Object.keys(cities).map(city => ({
    city,
    districts: cities[city],
    initial: getPinyinInitial(city.charAt(0))
  }));
  
  cityList.sort((a, b) => {
    if (a.initial < b.initial) return -1;
    if (a.initial > b.initial) return 1;
    return a.city.localeCompare(b.city, 'zh-CN');
  });
  
  res.json(cityList);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const cinema = db.prepare('SELECT * FROM cinemas WHERE id = ?').get(id);
  if (!cinema) {
    return res.status(404).json({ message: '影院不存在' });
  }
  res.json(cinema);
});

router.get('/:id/schedules', (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  
  let query = `
    SELECT s.*, m.title as movie_title, m.poster, m.duration, m.rating
    FROM schedules s
    JOIN movies m ON s.movie_id = m.id
    WHERE s.cinema_id = ?
  `;
  const params: any[] = [id];
  
  if (date) {
    query += ' AND DATE(s.start_time) = ?';
    params.push(date);
  }
  
  query += ' ORDER BY s.start_time ASC';

  const rows = db.prepare(query).all(...params) as any[];
  
  const grouped: { [key: string]: any[] } = {};
  rows.forEach(row => {
    if (!grouped[row.movie_id]) {
      grouped[row.movie_id] = [];
    }
    grouped[row.movie_id].push(row);
  });
  
  res.json(Object.keys(grouped).map(movieId => ({
    movie_id: movieId,
    movie_title: rows.find(r => r.movie_id === movieId)?.movie_title,
    poster: rows.find(r => r.movie_id === movieId)?.poster,
    duration: rows.find(r => r.movie_id === movieId)?.duration,
    rating: rows.find(r => r.movie_id === movieId)?.rating,
    schedules: grouped[movieId]
  })));
});

router.post('/', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { name, address, city, district, phone, image } = req.body;
  const id = uuidv4();
  
  db.prepare(
    'INSERT INTO cinemas (id, name, address, city, district, phone, image) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, address, city, district, phone, image);
  
  res.json({ id, message: '添加成功' });
});

router.put('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, address, city, district, phone, image } = req.body;
  
  db.prepare(
    'UPDATE cinemas SET name = ?, address = ?, city = ?, district = ?, phone = ?, image = ? WHERE id = ?'
  ).run(name, address, city, district, phone, image, id);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM cinemas WHERE id = ?').run(id);
  
  res.json({ message: '删除成功' });
});

export default router;
