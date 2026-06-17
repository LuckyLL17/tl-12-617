# 电影售票系统 - 功能扩展与代码优化建议

---

## 🚀 一、可扩展功能模块（从0-1开发）

### 1. 🎮 电影票抽奖转盘
**功能描述**：用户每日登录后可获得一次抽奖机会，奖品包括免费电影票、爆米花兑换券、折扣券等。
- 交互：点击转盘开始旋转，3秒后停止显示中奖结果，奖品自动存入用户卡包
- 后端：新增 `coupons` 表存储券信息，新增 `user_coupons` 表存储用户券包，新增抽奖接口每日限制1次
- 无依赖：独立功能，不依赖现有业务流程

### 2. 🎬 虚拟影院观影厅
**功能描述**：用户可以创建虚拟观影房间，邀请好友一起同步观看电影预告片或付费电影。
- 交互：创建房间 → 分享房间号 → 好友加入 → 同步播放控制（播放/暂停/进度）→ 实时聊天
- 后端：新增 `watch_rooms` 表，新增 WebSocket 连接管理，实时同步播放状态和聊天消息
- 无依赖：独立社交观影功能

### 3. 🎯 电影票房预测游戏
**功能描述**：用户可以对即将上映的电影进行票房预测，预测最接近实际票房的用户获得奖励。
- 交互：选择电影 → 输入预测票房金额 → 提交后不可修改 → 电影下映后公布结果 → 排名展示
- 后端：新增 `predictions` 表，计算预测误差，自动排名并发放奖励
- 无依赖：独立的预测游戏功能

### 4. 🎨 电影海报DIY
**功能描述**：用户可以选择电影模板，添加自己的照片和文字，生成个性化电影海报并分享。
- 交互：选择电影模板 → 上传头像 → 编辑文字（角色名、台词）→ 实时预览 → 保存下载
- 后端：新增 `user_posters` 表存储用户作品，提供海报模板配置，使用 Canvas 生成图片
- 无依赖：独立的创意工具功能

### 5. 🎭 电影角色配对测试
**功能描述**：通过回答一系列电影相关问题，测试用户最像哪个电影角色。
- 交互：开始测试 → 回答10道选择题 → 计算匹配度 → 显示匹配角色 → 分享结果
- 后端：新增 `character_tests` 表存储题目和角色信息，新增测试结果计算逻辑
- 无依赖：独立的趣味测试功能

### 6. 🏆 影迷等级勋章系统
**功能描述**：根据用户的购票次数、观影时长、评论数量等累计经验值，升级影迷等级并解锁勋章。
- 交互：查看个人等级 → 查看勋章墙 → 查看升级进度 → 等级特权展示
- 后端：新增 `user_levels` 表，新增 `medals` 表，新增经验值计算和等级升级逻辑
- 无依赖：独立的用户成长体系

### 7. 📝 电影观后感社区
**功能描述**：用户可以发布电影观后感长文，其他用户可以点赞、评论、收藏。
- 交互：撰写观后感 → 选择关联电影 → 发布 → 浏览社区 → 点赞/评论/收藏
- 后端：新增 `reviews` 表，新增 `review_likes`、`review_comments`、`review_favorites` 表
- 无依赖：独立的社区功能

### 8. 🎪 电影主题表情包生成器
**功能描述**：选择电影经典场景截图，添加自定义文字，生成表情包并下载。
- 交互：选择电影场景 → 输入文字 → 调整文字位置/大小/颜色 → 预览 → 保存分享
- 后端：新增 `meme_templates` 表存储模板，使用 Canvas 生成表情包图片
- 无依赖：独立的创意工具功能

### 9. 🎲 随机电影推荐机
**功能描述**：用户设置筛选条件（类型、时长、评分等），系统随机推荐一部电影，模拟老虎机效果。
- 交互：设置筛选条件 → 拉动拉杆 → 老虎机动画 → 显示推荐电影 → 查看详情/换一个
- 后端：根据筛选条件随机查询电影，新增推荐历史记录
- 无依赖：独立的发现功能

### 10. 🎵 电影原声带猜歌名
**功能描述**：播放电影原声音乐片段，用户猜测出自哪部电影。
- 交互：开始游戏 → 播放音乐 → 选择电影名称 → 显示对错 → 累计得分 → 排行榜
- 后端：新增 `soundtrack_quiz` 表存储音乐片段和答案，新增 `quiz_scores` 表存储得分
- 无依赖：独立的音乐游戏功能

---

## 🔄 二、可迭代功能模块（在已有功能上开发）

### 1. 🎫 订单退票改签
**迭代基础**：基于现有 [orders.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/server/src/routes/orders.ts) 订单功能
- 新增功能：开场前24小时可申请退票（收取10%手续费），开场前2小时可免费改签至同影院同电影其他场次
- 交互：订单详情页 → 点击退票/改签 → 选择退票原因/新场次 → 确认 → 退款到余额
- 后端：新增订单状态流转，新增退款金额计算逻辑

### 2. ⭐ 电影评分评价
**迭代基础**：基于现有 [MovieDetail.tsx](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/pages/MovieDetail.tsx) 电影详情功能
- 新增功能：已观影用户可对电影打星评分（1-5星）并撰写短评，其他用户可点赞评价
- 交互：电影详情页 → 评价区域 → 点击星星打分 → 输入评价 → 提交 → 查看所有评价
- 后端：新增 `movie_ratings` 表，更新电影平均评分

### 3. ❤️ 电影收藏关注
**迭代基础**：基于现有 [Movies.tsx](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/pages/Movies.tsx) 电影列表功能
- 新增功能：用户可收藏感兴趣的电影，电影有新排期时推送提醒
- 交互：电影卡片/详情 → 点击收藏按钮 → 个人中心查看收藏列表 → 取消收藏
- 后端：新增 `user_favorites` 表，新增查询用户收藏的电影排期接口

### 4. 🔍 高级搜索筛选
**迭代基础**：基于现有搜索功能
- 新增功能：支持按类型、地区、时长、评分区间、上映年份等多维度筛选电影
- 交互：搜索页 → 展开筛选面板 → 设置筛选条件 → 实时更新结果 → 重置条件
- 后端：扩展 [movies.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/server/src/routes/movies.ts) 查询参数支持

### 5. 📅 观影日历
**迭代基础**：基于现有订单和排期功能
- 新增功能：日历视图展示用户已购票的电影场次，可添加观影提醒
- 交互：个人中心 → 观影日历 → 查看每月观影记录 → 点击日期查看详情 → 设置提醒
- 后端：新增 `user_reminders` 表，按日期范围查询用户订单

### 6. 👥 邀请好友得优惠券
**迭代基础**：基于现有用户注册功能
- 新增功能：用户生成专属邀请码，好友注册并完成首单后，双方各得一张5元优惠券
- 交互：个人中心 → 邀请好友 → 复制邀请码/分享链接 → 查看邀请记录
- 后端：扩展 [auth.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/server/src/routes/auth.ts) 注册接口，新增邀请码关联逻辑

### 7. 🎟️ 会员卡套餐
**迭代基础**：基于现有订单支付功能
- 新增功能：推出月卡/季卡/年卡会员套餐，会员享受购票折扣、优先选座、生日福利
- 交互：会员中心 → 选择套餐 → 支付开通 → 查看会员权益 → 续费
- 后端：新增 `memberships` 表，新增会员价格配置，购票时自动计算折扣

### 8. 📊 个人观影报告
**迭代基础**：基于现有订单历史功能
- 新增功能：生成用户年度/月度观影报告，包括观影次数、总花费、最爱类型、观影时长统计
- 交互：个人中心 → 观影报告 → 选择时间范围 → 查看可视化报告 → 分享
- 后端：新增统计查询接口，聚合用户订单数据生成报告

### 9. 🗺️ 影院地图导航
**迭代基础**：基于现有 [Cinemas.tsx](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/pages/Cinemas.tsx) 影院列表功能
- 新增功能：地图模式展示附近影院，显示距离，点击可查看详情并导航
- 交互：影院列表 → 切换地图视图 → 查看影院位置 → 点击导航 → 选择导航方式
- 后端：新增影院经纬度字段，支持按距离排序

### 10. 🔔 消息通知中心
**迭代基础**：基于现有用户系统
- 新增功能：系统通知、订单通知、活动通知统一管理，支持已读/未读状态
- 交互：顶部通知图标 → 消息列表 → 标记已读 → 全部已读 → 删除消息
- 后端：新增 `notifications` 表，新增消息推送接口

---

## 💡 三、代码理解建议

### 建议1：深入理解订单事务处理机制
**代码位置**：[orders.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/server/src/routes/orders.ts#L72-L123)

**理解要点**：
```typescript
// 关键代码片段 - 订单创建事务
const tx = db.transaction(() => {
  insertOrder.run(orderId, userId, schedule_id, JSON.stringify(seats), totalPrice, 'paid');
  
  for (const seatId of seats) {
    currentSeats[seatId].sold = true;
  }
  
  updateSeats.run(JSON.stringify(currentSeats), schedule_id);
});

tx();
```

**理解路径**：
1. 首先理解 SQLite 事务的原子性：事务内的操作要么全部成功，要么全部回滚
2. 分析并发场景：两个用户同时选购同一个座位时，事务如何保证数据一致性
3. 追踪座位状态流转：`available` → `sold` 的条件判断和更新时机
4. 思考异常处理：如果事务执行过程中抛出异常，数据如何回滚

**理解实践**：
- 尝试模拟并发请求，手动制造座位冲突场景，观察系统表现
- 在事务前后添加日志，理解事务执行流程
- 分析如果不使用事务，可能出现的数据不一致问题

---

### 建议2：理解前端状态持久化与路由守卫
**代码位置**：[authStore.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/store/authStore.ts) 和 [App.tsx](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/App.tsx#L22-L35)

**理解要点**：
```typescript
// Zustand 状态持久化
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage'
    }
  )
);

// 路由守卫
function PrivateRoute({ children, requireAdmin = false }) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

**理解路径**：
1. 理解 Zustand `persist` 中间件的工作原理：如何自动将状态同步到 localStorage
2. 分析页面刷新后的状态恢复流程：从 localStorage 读取 → 恢复到 store → 组件重新渲染
3. 理解路由守卫的重定向逻辑：未登录时跳转到登录页，登录后跳回原页面
4. 追踪 Token 在 API 请求中的传递：[api.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/services/api.ts#L14-L33) 拦截器如何自动添加 Authorization 头

**理解实践**：
- 在浏览器 DevTools 中观察 localStorage 的 `auth-storage` 数据变化
- 手动删除 localStorage 中的 token，观察页面是否自动跳转到登录页
- 分析 `state={{ from: location }}` 的作用，理解登录后如何跳回原页面

---

## 🔧 四、代码重构建议

### 建议1：重构数据库操作层，引入 Repository 模式
**问题分析**：
当前项目所有 SQL 语句都直接写在路由文件中（如 [orders.ts](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/server/src/routes/orders.ts)），存在以下问题：
- SQL 语句分散，难以维护和复用
- 路由层职责过重，既处理请求又处理数据访问
- 缺乏统一的错误处理和参数校验
- 难以进行单元测试

**重构方案**：

1. **创建 Repository 目录结构**
```
server/src/
  repositories/
    UserRepository.ts
    MovieRepository.ts
    CinemaRepository.ts
    ScheduleRepository.ts
    OrderRepository.ts
    index.ts
```

2. **OrderRepository 示例实现**
```typescript
// server/src/repositories/OrderRepository.ts
import db from '../database';

export interface CreateOrderParams {
  userId: string;
  scheduleId: string;
  seats: string[];
  totalPrice: number;
}

export class OrderRepository {
  private db = db;

  findById(id: string, userId?: string) {
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
    
    if (userId) {
      query += ' AND o.user_id = ?';
      params.push(userId);
    }

    const row = this.db.prepare(query).get(...params) as any;
    if (row?.seats) {
      row.seats = JSON.parse(row.seats);
    }
    return row;
  }

  findByUserId(userId: string) {
    const rows = this.db.prepare(`
      SELECT o.*, s.start_time, s.hall, s.price, m.title as movie_title, m.poster, c.name as cinema_name
      FROM orders o
      JOIN schedules s ON o.schedule_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(userId) as any[];
    
    rows.forEach(row => {
      if (row.seats) row.seats = JSON.parse(row.seats);
    });
    return rows;
  }

  create(params: CreateOrderParams, updateSeatsFn: () => void) {
    const { userId, scheduleId, seats, totalPrice } = params;
    const orderId = uuidv4();
    
    const insertOrder = this.db.prepare(
      'INSERT INTO orders (id, user_id, schedule_id, seats, total_price, status) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const tx = this.db.transaction(() => {
      insertOrder.run(orderId, userId, scheduleId, JSON.stringify(seats), totalPrice, 'paid');
      updateSeatsFn();
    });
    
    tx();
    return orderId;
  }

  updateStatus(id: string, status: string) {
    return this.db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  }
}
```

3. **路由层重构后**
```typescript
// server/src/routes/orders.ts
import { OrderRepository } from '../repositories';

const orderRepository = new OrderRepository();

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  
  let orders;
  if (userRole === 'admin') {
    orders = orderRepository.findAll();
  } else {
    orders = orderRepository.findByUserId(userId!);
  }
  
  res.json(orders);
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { schedule_id, seats } = req.body;
  
  // 参数校验移至单独的 validator 层
  const schedule = scheduleRepository.findById(schedule_id);
  if (!schedule) {
    return res.status(404).json({ message: '排片不存在' });
  }
  
  // 座位校验
  const currentSeats = JSON.parse(schedule.seats);
  for (const seatId of seats) {
    if (!currentSeats[seatId]?.available || currentSeats[seatId]?.sold) {
      return res.status(400).json({ message: `座位 ${seatId} 不可用` });
    }
  }
  
  const totalPrice = schedule.price * seats.length;
  
  const orderId = orderRepository.create(
    { userId: userId!, scheduleId: schedule_id, seats, totalPrice },
    () => {
      for (const seatId of seats) {
        currentSeats[seatId].sold = true;
      }
      scheduleRepository.updateSeats(schedule_id, currentSeats);
    }
  );
  
  res.json({ id: orderId, message: '购票成功' });
});
```

**重构收益**：
- 数据访问逻辑集中管理，便于维护和优化
- 路由层职责单一，专注于请求处理和响应
- Repository 可单独进行单元测试
- 便于后续切换数据库（如从 SQLite 切换到 PostgreSQL）

---

### 建议2：引入前端请求状态管理与错误处理封装
**问题分析**：
当前前端页面（如 [SeatSelection.tsx](file:///Volumes/ExMac/traeProject/全栈/tl-12/tl-12-1/client/src/pages/SeatSelection.tsx)）的请求处理存在以下问题：
- 每个页面都重复写 loading 状态管理
- 错误处理不一致，部分使用 console.error，部分使用 alert
- 缺乏统一的错误提示和重试机制
- 代码冗余，难以维护

**重构方案**：

1. **创建 useRequest Hook**
```typescript
// client/src/hooks/useRequest.ts
import { useState, useCallback } from 'react';

interface UseRequestOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  manual?: boolean;
  defaultLoading?: boolean;
}

interface UseRequestResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  run: (...args: any[]) => Promise<T | null>;
  refresh: () => Promise<T | null>;
  reset: () => void;
}

export function useRequest<T = any>(
  requestFn: (...args: any[]) => Promise<any>,
  options: UseRequestOptions<T> = {}
): UseRequestResult<T> {
  const { onSuccess, onError, manual = false, defaultLoading = false } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(defaultLoading);
  const [error, setError] = useState<any>(null);
  const [lastArgs, setLastArgs] = useState<any[]>([]);

  const run = useCallback(async (...args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);
    setLastArgs(args);
    
    try {
      const response = await requestFn(...args);
      const result = response.data;
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err: any) {
      setError(err);
      
      const errorMessage = err.response?.data?.message || err.message || '请求失败';
      // 统一错误提示
      if (err.response?.status !== 401) {
        // 使用全局 Toast 组件，而非 alert
        console.error(errorMessage);
      }
      
      onError?.(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestFn, onSuccess, onError]);

  const refresh = useCallback((): Promise<T | null> => {
    return run(...lastArgs);
  }, [run, lastArgs]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  // 非手动模式自动执行
  if (!manual && !data && !loading && !error) {
    run();
  }

  return { data, loading, error, run, refresh, reset };
}
```

2. **创建全局 Toast 组件**
```typescript
// client/src/components/Toast.tsx
import { create } from 'zustand';

interface ToastState {
  messages: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;
  show: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  messages: [],
  show: (type, message, duration = 3000) => {
    const id = Date.now().toString();
    set((state) => ({
      messages: [...state.messages, { id, type, message }]
    }));
    setTimeout(() => {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id)
      }));
    }, duration);
  },
  remove: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id)
    }));
  }
}));

export function ToastContainer() {
  const { messages, remove } = useToastStore();
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          onClick={() => remove(msg.id)}
          className={`px-4 py-3 rounded-lg shadow-lg cursor-pointer transform transition-all ${
            msg.type === 'success' ? 'bg-green-500 text-white' :
            msg.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}
        >
          {msg.message}
        </div>
      ))}
    </div>
  );
}

// 便捷方法
export const toast = {
  success: (message: string) => useToastStore.getState().show('success', message),
  error: (message: string) => useToastStore.getState().show('error', message),
  info: (message: string) => useToastStore.getState().show('info', message),
};
```

3. **重构后页面使用示例**
```typescript
// client/src/pages/SeatSelection.tsx
import { useRequest } from '../hooks/useRequest';
import { toast } from '../components/Toast';

export default function SeatSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ticketCount = parseInt(searchParams.get('tickets') || '1', 10);
  
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  
  // 使用 useRequest 管理请求状态
  const { 
    data: schedule, 
    loading, 
    error, 
    refresh 
  } = useRequest<Schedule>(
    () => id ? scheduleAPI.getSchedule(id) : Promise.reject('缺少ID'),
    {
      manual: !id,
      onSuccess: (data) => {
        console.log('排片信息加载成功');
      },
      onError: (err) => {
        toast.error('获取排片信息失败');
      }
    }
  );

  // 创建订单请求
  const { run: createOrder, loading: submitting } = useRequest(
    (seats: string[]) => orderAPI.createOrder({ schedule_id: id!, seats }),
    {
      manual: true,
      onSuccess: (data) => {
        toast.success('购票成功！');
        navigate(`/orders/${data.id}`);
      },
      onError: (err) => {
        const message = err.response?.data?.message || '购票失败，请重试';
        toast.error(message);
      }
    }
  );

  const handleNext = () => {
    if (selectedSeats.length !== ticketCount) {
      toast.info(`请选择 ${ticketCount} 个座位`);
      return;
    }
    createOrder(selectedSeats);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-6xl mb-4">😢</div>
        <p className="mb-4">{error?.response?.data?.message || '排片不存在'}</p>
        <button 
          onClick={refresh}
          className="px-4 py-2 bg-red-500 text-white rounded-lg"
        >
          重新加载
        </button>
      </div>
    );
  }

  // ... 其余渲染逻辑保持不变
}
```

**重构收益**：
- 消除重复的 loading、error 状态管理代码
- 统一错误处理和用户提示
- 代码更简洁，可读性更高
- 便于后续添加请求缓存、防抖等高级功能

---

## 🧪 五、代码测试建议

### 建议1：后端 API 接口单元测试与集成测试

**测试框架选择**：Jest + Supertest

**测试配置**：
```typescript
// server/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

**测试环境设置**：
```typescript
// server/src/__tests__/setup.ts
import Database from 'better-sqlite3';
import path from 'path';

// 使用内存数据库进行测试
const testDbPath = path.join(__dirname, '../../test.db');

// 测试前创建测试数据库
beforeAll(() => {
  process.env.PORT = '3002';
  process.env.NODE_ENV = 'test';
});

// 每个测试前重置数据库
beforeEach(() => {
  const db = new Database(testDbPath);
  db.exec('DROP TABLE IF EXISTS orders, schedules, cinemas, movies, users');
  db.close();
});

// 测试后清理
afterAll(() => {
  const fs = require('fs');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
```

**测试用例示例 - 认证接口**：
```typescript
// server/src/__tests__/auth.test.ts
import request from 'supertest';
import express from 'express';
import { initDatabase } from '../database';
import authRoutes from '../routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

beforeAll(() => {
  initDatabase();
});

describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: '测试用户',
        phone: '13800138001'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('username', 'testuser');
    expect(response.body.user.role).toBe('user');
  });

  it('should return error when username already exists', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser2',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: '测试用户2',
        phone: '13800138002'
      });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser2',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: '测试用户3',
        phone: '13800138003'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('用户名已存在');
  });

  it('should return error when passwords do not match', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser3',
        password: 'password123',
        confirmPassword: 'password456',
        nickname: '测试用户',
        phone: '13800138004'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('两次输入的密码不一致');
  });

  it('should validate phone number format', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser4',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: '测试用户',
        phone: '12345678901'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('请输入正确的11位手机号');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'loginuser',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: '登录测试',
        phone: '13900139000'
      });
  });

  it('should login successfully with correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'loginuser',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.username).toBe('loginuser');
  });

  it('should return error with wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'loginuser',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('用户名或密码错误');
  });

  it('should return error with non-existent user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'nonexistent',
        password: 'password123'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('用户名或密码错误');
  });
});
```

**测试用例示例 - 订单创建并发测试**：
```typescript
// server/src/__tests__/orders.test.ts
import request from 'supertest';
import express from 'express';
import db, { initDatabase } from '../database';
import authRoutes from '../routes/auth';
import orderRoutes from '../routes/orders';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

let userToken: string;
let scheduleId: string;

beforeAll(async () => {
  initDatabase();
  
  // 注册用户
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'orderuser',
      password: 'password123',
      confirmPassword: 'password123',
      nickname: '订单测试',
      phone: '13700137000'
    });
  userToken = registerRes.body.token;
  
  // 获取一个排期
  const schedule = db.prepare('SELECT * FROM schedules LIMIT 1').get() as any;
  scheduleId = schedule.id;
});

describe('POST /api/orders - 并发座位测试', () => {
  it('should handle concurrent seat selection correctly', async () => {
    // 重置座位状态
    const seats = {};
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        const seatId = `${String.fromCharCode(65 + r)}${c + 1}`;
        seats[seatId] = { available: true, sold: false };
      }
    }
    db.prepare('UPDATE schedules SET seats = ? WHERE id = ?').run(
      JSON.stringify(seats), 
      scheduleId
    );

    // 模拟两个用户同时购买同一个座位
    const concurrentRequests = Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          schedule_id: scheduleId,
          seats: ['A1']
        }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          schedule_id: scheduleId,
          seats: ['A1']
        })
    ]);

    const [res1, res2] = await concurrentRequests;
    
    // 应该只有一个成功，一个失败
    const successCount = [res1.status, res2.status].filter(s => s === 200).length;
    const failCount = [res1.status, res2.status].filter(s => s === 400).length;
    
    expect(successCount).toBe(1);
    expect(failCount).toBe(1);
    
    // 验证座位确实只被卖了一次
    const updatedSchedule = db.prepare(
      'SELECT seats FROM schedules WHERE id = ?'
    ).get(scheduleId) as any;
    const updatedSeats = JSON.parse(updatedSchedule.seats);
    expect(updatedSeats['A1'].sold).toBe(true);
  });
});
```

**测试执行命令**：
```json
// server/package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**测试覆盖率目标**：
- 路由层覆盖率 >= 80%
- 核心业务逻辑（订单、认证）覆盖率 >= 90%
- Repository 层覆盖率 >= 95%

---

### 建议2：前端组件单元测试与 E2E 测试

**测试框架选择**：Vitest + React Testing Library + Playwright

**Vitest 配置**：
```typescript
// client/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
  },
});
```

**测试环境设置**：
```typescript
// client/src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**API Mock 示例**：
```typescript
// client/src/__tests__/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/movies', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'movie-001',
          title: '流浪地球3',
          poster: 'https://example.com/poster.jpg',
          description: '电影描述',
          duration: 173,
          rating: 8.3,
          release_date: '2025-01-22',
          genre: '科幻/冒险/灾难',
          status: 'showing'
        }
      ])
    );
  }),

  rest.post('/api/auth/login', (req, res, ctx) => {
    const { username, password } = req.body as any;
    
    if (username === 'admin' && password === 'admin123') {
      return res(
        ctx.status(200),
        ctx.json({
          token: 'mock-token-12345',
          user: {
            id: 'admin-001',
            username: 'admin',
            nickname: '管理员',
            role: 'admin'
          }
        })
      );
    }
    
    return res(
      ctx.status(400),
      ctx.json({ message: '用户名或密码错误' })
    );
  })
];
```

**组件测试示例 - 登录页**：
```typescript
// client/src/__tests__/Login.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { useAuthStore } from '../store/authStore';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  it('should render login form correctly', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument();
  });

  it('should show validation error for empty fields', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /登录/i }));

    await waitFor(() => {
      expect(screen.getByText(/请输入用户名/i)).toBeInTheDocument();
    });
  });

  it('should login successfully with correct credentials', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/用户名/i), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText(/密码/i), {
      target: { value: 'admin123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));

    await waitFor(() => {
      const { user, token } = useAuthStore.getState();
      expect(user?.username).toBe('admin');
      expect(token).toBe('mock-token-12345');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should show error message with wrong credentials', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/用户名/i), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText(/密码/i), {
      target: { value: 'wrongpassword' }
    });
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
  });
});
```

**E2E 测试示例 - 购票流程**：
```typescript
// client/e2e/booking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('电影购票流程', () => {
  test('完整购票流程测试', async ({ page }) => {
    // 1. 访问首页
    await page.goto('/');
    await expect(page.locator('text=热门电影')).toBeVisible();

    // 2. 点击第一部电影
    await page.click('.movie-card:first-child');
    await expect(page.locator('text=立即购票')).toBeVisible();

    // 3. 点击购票
    await page.click('text=立即购票');
    
    // 4. 选择影院和场次
    await page.click('.cinema-item:first-child');
    await page.click('.schedule-item:first-child');
    
    // 5. 选择票数
    await page.selectOption('#ticketCount', '2');
    await page.click('text=下一步');

    // 6. 跳转到登录页（未登录状态）
    await expect(page).toHaveURL('/login');
    
    // 7. 登录
    await page.fill('input[name="username"]', 'user1');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');

    // 8. 登录后跳回选座页
    await expect(page).toHaveURL(/\/schedules\/.*\/seats/);

    // 9. 选择2个座位
    const seats = page.locator('.seat-available');
    await seats.nth(0).click();
    await seats.nth(1).click();

    // 10. 确认购买
    await page.click('text=下一步');

    // 11. 跳转到订单详情页
    await expect(page).toHaveURL(/\/orders\/.*/);
    await expect(page.locator('text=购票成功')).toBeVisible();
  });
});
```

**测试收益**：
- 保证核心业务逻辑正确性
- 便于回归测试，防止引入新 bug
- 提升代码质量，迫使开发者编写可测试的代码
- E2E 测试模拟真实用户操作，保障用户体验

---

## 🏗️ 六、代码工程化建议

### 建议1：引入 Monorepo 架构与统一构建工具链

**当前问题**：
- 前后端为两个独立项目，依赖管理分散
- 类型定义重复（如 Movie、User 等接口前后端各定义一份）
- 缺乏统一的代码规范和提交规范
- 版本管理和发布流程不统一

**改造方案 - 使用 pnpm workspaces + Turborepo**：

1. **目录结构调整**
```
movie-ticket-system/
├── packages/
│   ├── client/              # 前端应用（原 client）
│   ├── server/              # 后端应用（原 server）
│   └── shared/              # 共享代码
│       ├── types/           # 共享类型定义
│       ├── constants/       # 共享常量
│       └── utils/           # 共享工具函数
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

2. **pnpm workspace 配置**
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

3. **Turborepo 配置**
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

4. **共享类型定义**
```typescript
// packages/shared/types/index.ts
export interface User {
  id: string;
  username: string;
  nickname: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Movie {
  id: string;
  title: string;
  poster: string;
  description: string;
  duration: number;
  rating: number;
  release_date: string;
  genre: string;
  director: string;
  cast: string;
  status: 'showing' | 'coming' | 'offline';
  created_at: string;
}

// 更多共享类型...
```

5. **根 package.json 脚本**
```json
{
  "name": "movie-ticket-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.3.3",
    "prettier": "^3.1.0",
    "eslint": "^8.56.0",
    "@types/node": "^20.10.5"
  }
}
```

**改造收益**：
- 类型定义统一维护，避免前后端不一致
- 依赖集中管理，版本统一
- 构建流程优化，支持并行构建和增量构建
- 便于后续添加更多微服务/微前端包

---

### 建议2：引入完整的代码质量保障体系

**当前问题**：
- 缺乏统一的代码风格规范
- 没有 Git 提交规范
- 没有自动化代码检查流程
- 代码质量依赖人工 Code Review

**改造方案**：

1. **ESLint + Prettier 代码规范**
```javascript
// .eslintrc.js
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['dist', 'node_modules', '*.db'],
};
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

2. **Husky + lint-staged Git 钩子**
```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

```bash
# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit "$1"
```

3. **Commitlint 提交规范**
```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复bug
        'docs',     // 文档更新
        'style',    // 代码格式调整
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试相关
        'chore',    // 构建/工具相关
        'revert',   // 回滚
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
```

**提交示例**：
```
feat(movies): 添加电影收藏功能
fix(orders): 修复并发选座时的事务问题
docs(readme): 更新API接口文档
style(*): 统一代码格式
refactor(server): 引入Repository模式
perf(api): 优化电影列表查询性能
```

4. **GitHub Actions CI/CD**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm run install:all
        
      - name: Lint
        run: npm run lint
        
      - name: Type check
        run: |
          cd client && npx tsc --noEmit
          cd ../server && npx tsc --noEmit
          
      - name: Test server
        run: cd server && npm test
        
      - name: Build
        run: npm run build
```

5. **环境变量管理**
```env
# .env.example
# 服务器配置
PORT=3001
NODE_ENV=development

# JWT 配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# 数据库配置
DB_PATH=./movie_ticket.db

# 前端配置
VITE_API_BASE_URL=/api
```

创建 `.env` 文件并加入 `.gitignore`，使用 `dotenv` 加载环境变量：
```typescript
// server/src/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './movie_ticket.db',
};
```

**改造收益**：
- 代码风格统一，降低维护成本
- Git 提交历史清晰，便于追踪问题
- 自动化检查减少人工 Code Review 负担
- CI/CD 保障每次提交的代码质量
- 环境变量配置更安全，避免敏感信息泄露

---

## 📊 七、实施优先级建议

| 类别 | 建议 | 优先级 | 预计工作量 | 依赖 |
|------|------|--------|------------|------|
| 代码工程化 | ESLint + Prettier 代码规范 | 🔥 最高 | 低 | 无 |
| 代码工程化 | Husky + commitlint Git 钩子 | 🔥 最高 | 低 | 无 |
| 代码重构 | Repository 模式重构 | ⭐ 高 | 中 | 无 |
| 代码重构 | useRequest Hook 封装 | ⭐ 高 | 低 | 无 |
| 代码测试 | 后端核心接口单元测试 | ⭐ 高 | 中 | Repository 重构后 |
| 代码工程化 | 环境变量管理 | ⭐ 高 | 低 | 无 |
| 代码测试 | 前端组件单元测试 | 📈 中 | 中 | 无 |
| 代码工程化 | Monorepo 架构改造 | 📈 中 | 高 | 无 |
| 代码工程化 | GitHub Actions CI/CD | 📈 中 | 中 | 测试完成后 |
| 代码测试 | E2E 测试 | 📌 低 | 高 | 核心功能稳定后 |

---

*文档最后更新：2026-05-24*
