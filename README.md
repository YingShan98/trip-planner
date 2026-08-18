# Trip Planner — 通用多人协作旅行规划器

一个 **mobile-first、无需账号即可查看、密码编辑、Supabase Realtime 实时同步** 的旅行规划器。

适合家庭、朋友、多人旅行团共同规划。一个 Supabase 项目可以保存很多旅行：广州、韩国、日本、欧洲……都可以复用。

## 功能

- 多旅行管理：创建、复制、删除、打开不同旅行
- 公开查看：拿到链接即可查看，不需要登录
- 密码编辑：每个旅行拥有独立编辑密码
- 实时同步：Supabase Realtime 推送其他人的修改
- 行程：任意天数、添加/删除/上下移动 Day、添加/删除活动
- 活动：时间、内容、交通、费用、地图、链接、备注
- Checklist：勾选、添加、删除
- 酒店：多个候选、排名、地址、优缺点、链接、备注
- 交通参考：可自定义车型/交通方式/说明/价格
- 预算：可自定义预算分类、人数、单价、备注
- 留言板：多人共同讨论
- JSON 导入/导出：方便备份与迁移
- 打印 / PDF
- 手机与桌面响应式布局
- 不需要构建工具，直接部署到 GitHub Pages 即可

## 技术

- React 18 + TypeScript + Vite
- Supabase JS v2
- Supabase Postgres + RPC + Realtime
- GitHub Pages / Netlify / Vercel 均可部署

## 1. 创建 Supabase 项目

你目前的 Supabase 项目可以直接使用，例如：`Trip Planner`，区域 Tokyo 也可以。

## 2. 初始化数据库

打开 Supabase Dashboard → SQL Editor → New query。

把 `supabase/schema.sql` 的全部内容粘贴进去执行。

脚本会创建：

- `trip_documents`：公开可读的旅行数据
- `trip_secrets`：私有编辑密码哈希
- `app_settings`：私有系统设置
- RLS policies
- 创建/验证/保存/删除/改密码等安全 RPC
- Realtime publication

> SQL 文件里的 `CHANGE_ME_ADMIN_PASSWORD` 是你自己设置的“旅行管理密码”。不要把它写进前端代码。

## 3. 配置前端

复制：

```text
.env.example → .env
```

填写 Supabase Dashboard → Project Settings → API 中的：

- Project URL → `VITE_SUPABASE_URL`
- Publishable key / anon public key → `VITE_SUPABASE_KEY`

`.env` 已加入 `.gitignore`，所以不会被 Git 提交。这些值在构建时会被 Vite 打包进前端代码。

**anon/publishable key 可以出现在前端；Database Password、service_role key 绝对不要放进前端。**

## 4. 本地测试

```bash
npm install
npm run dev
```

然后访问终端输出的地址（默认 `http://localhost:5173/trip-planner/`）。

其他常用命令：

```bash
npm run build      # 生产构建到 dist/
npm run preview    # 本地预览生产构建
npm run typecheck  # TypeScript 类型检查
```

## 5. GitHub Pages

1. 新建 GitHub repository，例如 `trip-planner`
2. 上传本仓库所有文件（**不要**上传 `.env`、`node_modules/`、`dist/`）
3. Repository → Settings → Secrets and variables → Actions → **Variables** 标签页，添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
   （这些是 publishable/anon key，不是密钥，用 Variables 而不是 Secrets 即可）
4. GitHub → Settings → Pages → Source 选择 `GitHub Actions`
5. 推送到 `main` 分支，`.github/workflows/pages.yml` 会自动执行 `npm ci && npm run build` 并部署 `dist/`

然后你会得到类似：

```text
https://你的用户名.github.io/trip-planner/
```

每个旅行可以使用：

```text
https://你的用户名.github.io/trip-planner/?trip=guangzhou-family-trip-2027
```

把对应 URL 发进亲友群即可。

## 6. 创建旅行

首页点击「＋ 新建旅行」。系统会要求输入系统管理密码（SQL 中设置的 admin password）。

创建后，为该旅行设置独立编辑密码。

### 建议

- Admin password：只自己知道，用于创建/删除/管理旅行
- Trip edit password：分享给同行亲友，用于编辑某一趟旅行
- 查看者：无需任何密码

## 7. 导入现有广州行程

仓库提供：

```text
seed/guangzhou-family-trip-2027.json
```

进入 Trip Planner 后使用「导入 JSON」即可载入已有广州行程数据。导入会覆盖当前旅行的数据，因此建议先导出备份。

## 安全说明

这是“家庭/朋友协作”级别的共享系统，而不是企业级账号系统。编辑密码通过数据库端 SHA-256 哈希校验；匿名客户端不能直接 UPDATE 数据表，只能调用数据库 RPC。

如果以后需要更强的安全性，可以升级到 Supabase Auth + magic link / email login。
