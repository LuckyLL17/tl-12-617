# 🎬 电影售票系统

一个基于 React + TypeScript + Express + SQLite 的全栈电影售票网站，包含用户端和管理端。

## 📋 项目概述

本项目是一个完整的电影票务系统，提供电影浏览、影院查询、在线选座购票等功能。系统采用前后端分离架构，前端使用 React 构建，后端使用 Express 提供 RESTful API，数据持久化使用 SQLite 数据库。

## 🏗️ 技术架构 

### 前端技术栈

| 技术           | 版本     | 用途       |
| ------------ | ------ | -------- |
| React        | 18.2.0 | UI 框架    |
| TypeScript   | 5.3.3  | 类型系统     |
| Vite         | 5.0.8  | 构建工具     |
| React Router | 6.20.1 | 路由管理     |
| Zustand      | 4.4.7  | 状态管理     |
| Tailwind CSS | 3.3.6  | CSS 框架   |
| Axios        | 1.6.2  | HTTP 客户端 |

### 后端技术栈

| 技术                       | 版本     | 用途     |
| ------------------------ | ------ | ------ |
| Express                  | 4.18.2 | Web 框架 |
| TypeScript               | 5.3.3  | 类型系统   |
| SQLite3 (better-sqlite3) | 11.3.0 | 数据库    |
| JWT                      | 9.0.2  | 身份认证   |
| bcryptjs                 | 2.4.3  | 密码加密   |
| CORS                     | 2.8.5  | 跨域处理   |

## 📁 项目结构

```
movie-ticket-system/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── components/        # 公共组件
│   │   │   ├── admin/         # 管理端布局组件
│   │   │   ├── CinemaCard.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── MovieCard.tsx
│   │   ├── pages/             # 页面组件
│   │   │   ├── admin/         # 管理端页面
│   │   │   │   ├── Cinemas.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Movies.tsx
│   │   │   │   ├── Orders.tsx
│   │   │   │   ├── Schedules.tsx
│   │   │   │   └── Users.tsx
│   │   │   ├── CinemaDetail.tsx
│   │   │   ├── Cinemas.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── MovieDetail.tsx
│   │   │   ├── Movies.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Register.tsx
│   │   │   └── SeatSelection.tsx
│   │   ├── services/          # API 服务
│   │   │   └── api.ts
│   │   ├── store/             # 状态管理
│   │   │   └── authStore.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                    # 后端项目
│   ├── src/
│   │   ├── middleware/        # 中间件
│   │   │   └── auth.ts
│   │   ├── routes/            # 路由
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   ├── cinemas.ts
│   │   │   ├── movies.ts
│   │   │   ├── orders.ts
│   │   │   └── schedules.ts
│   │   ├── database.ts        # 数据库初始化
│   │   └── index.ts           # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── package.json               # 根项目配置
└── README.md
```

## ✨ 功能模块

### 用户端功能

| 模块    | 功能描述                |
| ----- | ------------------- |
| 🏠 首页 | 展示热映电影、即将上映、推荐影院    |
| 🎬 电影 | 电影列表浏览、电影详情、评分、演员信息 |
| 🏢 影院 | 影院列表、影院详情、排期查询      |
| 🪑 选座 | 在线选座、座位状态实时显示       |
| 🎫 订单 | 订单创建、订单详情、订单历史      |
| 👤 用户 | 用户注册、登录、个人中心、订单管理   |

### 管理端功能

| 模块      | 功能描述         |
| ------- | ------------ |
| 📊 仪表盘  | 数据统计概览       |
| 🎬 电影管理 | 电影增删改查、上下架管理 |
| 🏢 影院管理 | 影院信息管理       |
| 📅 排期管理 | 场次安排、价格设置    |
| 📋 订单管理 | 订单查询、状态管理    |
| 👥 用户管理 | 用户列表、权限管理    |

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd movie-ticket-system
```

1. **安装依赖**

```bash
npm run install:all
```

1. **启动开发服务器**

```bash
npm run dev
```

服务启动后：

- 用户端: <http://localhost:3001>
- 管理端: <http://localhost:3001/admin>

### 测试账号

| 角色   | 用户名   | 密码       |
| ---- | ----- | -------- |
| 管理员  | admin | admin123 |
| 普通用户 | user1 | 123456   |

## 📦 构建部署

### 构建前端

```bash
npm run build
```

### 启动生产服务器

```bash
npm run start
```

## 🗄️ 数据库设计

### 数据表结构

| 表名        | 说明  | 主要字段                                                     |
| --------- | --- | -------------------------------------------------------- |
| users     | 用户表 | id, username, password, nickname, role                   |
| movies    | 电影表 | id, title, poster, description, duration, rating, status |
| cinemas   | 影院表 | id, name, address, city, district, phone                 |
| schedules | 排期表 | id, movie\_id, cinema\_id, start\_time, price, seats     |
| orders    | 订单表 | id, user\_id, schedule\_id, seats, total\_price, status  |

### 数据库初始化

系统启动时会自动初始化数据库并插入测试数据：

- 2 个测试用户（管理员 + 普通用户）
- 6 部电影（热映 + 即将上映）
- 6 家影院
- 13 个排期场次

## 🔌 API 接口

### 认证接口

| 方法   | 路径                 | 描述     |
| ---- | ------------------ | ------ |
| POST | /api/auth/register | 用户注册   |
| POST | /api/auth/login    | 用户登录   |
| GET  | /api/auth/me       | 获取当前用户 |

### 电影接口

| 方法  | 路径              | 描述     |
| --- | --------------- | ------ |
| GET | /api/movies     | 获取电影列表 |
| GET | /api/movies/:id | 获取电影详情 |

### 影院接口

| 方法  | 路径               | 描述     |
| --- | ---------------- | ------ |
| GET | /api/cinemas     | 获取影院列表 |
| GET | /api/cinemas/:id | 获取影院详情 |

### 排期接口

| 方法  | 路径                 | 描述     |
| --- | ------------------ | ------ |
| GET | /api/schedules     | 获取排期列表 |
| GET | /api/schedules/:id | 获取排期详情 |

### 订单接口

| 方法   | 路径              | 描述     |
| ---- | --------------- | ------ |
| GET  | /api/orders     | 获取用户订单 |
| POST | /api/orders     | 创建订单   |
| GET  | /api/orders/:id | 获取订单详情 |

### 管理接口

| 方法  | 路径                   | 描述    |
| --- | -------------------- | ----- |
| GET | /api/admin/dashboard | 仪表盘数据 |
| GET | /api/admin/users     | 用户列表  |
| GET | /api/admin/orders    | 所有订单  |

## 🔒 安全特性

- JWT Token 身份认证
- 密码 bcrypt 加密存储
- 管理员权限中间件校验
- CORS 跨域配置

## 🛠️ 开发命令

| 命令                    | 描述           |
| --------------------- | ------------ |
| `npm run dev`         | 同时启动前后端开发服务器 |
| `npm run dev:client`  | 仅启动前端开发服务器   |
| `npm run dev:server`  | 仅启动后端开发服务器   |
| `npm run build`       | 构建前端生产包      |
| `npm run start`       | 启动生产服务器      |
| `npm run install:all` | 安装所有依赖       |

## 📝 开发计划

- [x] 用户认证系统（注册/登录/JWT）
- [x] 电影浏览与搜索
- [x] 影院查询
- [x] 在线选座购票
- [x] 订单管理
- [x] 管理后台
- [ ] 支付接口集成
- [ ] 短信验证码
- [ ] 邮件通知
- [ ] 数据导出

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

***

Made with ❤️ by Movie Ticket Team
