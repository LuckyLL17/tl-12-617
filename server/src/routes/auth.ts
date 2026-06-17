import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import JWT_SECRET, { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password, confirmPassword, nickname, phone } = req.body;
  
  if (!username || !password || !confirmPassword || !nickname || !phone) {
    return res.status(400).json({ message: '所有字段均为必填项' });
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: '用户名需为3-20位字母、数字或下划线' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: '密码长度至少6位' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: '两次输入的密码不一致' });
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ message: '昵称长度需为2-20位' });
  }

  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: '请输入正确的11位手机号' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existingPhone) {
    return res.status(400).json({ message: '手机号已被注册' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  const id = uuidv4();
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

  db.prepare(
    'INSERT INTO users (id, username, password, nickname, phone, avatar, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, username, hashedPassword, nickname || username, phone || '', avatar, 'user');

  const token = jwt.sign(
    { id, username, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const user = db.prepare('SELECT id, username, nickname, phone, avatar, role, created_at FROM users WHERE id = ?').get(id);
  
  res.json({
    token,
    user
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(400).json({ message: '用户名或密码错误' });
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.status(400).json({ message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      created_at: user.created_at
    }
  });
});

router.get('/profile', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  
  const user = db.prepare(
    'SELECT id, username, nickname, phone, avatar, role, created_at FROM users WHERE id = ?'
  ).get(userId);
  
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }
  res.json(user);
});

router.put('/profile', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { nickname, phone, avatar } = req.body;
  
  db.prepare(
    'UPDATE users SET nickname = ?, phone = ?, avatar = ? WHERE id = ?'
  ).run(nickname, phone, avatar, userId);
  
  res.json({ message: '更新成功' });
});

export default router;
