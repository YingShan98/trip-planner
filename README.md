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
3. Repository → Settings → Secrets and variables → Actions → **Secrets** 标签页，添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
   （这些是 publishable/anon key，CI workflow 从 `secrets.*` 读取）
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

## v2 数据库（全新规范化结构）

`supabase/schema-v2.sql` 是新的规范化数据库结构，将行程、Day、活动、链接、住宿、交通、预算、Checklist、打包清单和留言拆成独立表。当前 React 界面仍使用旧版 `trip_documents` JSONB 结构；执行 v2 初始化后，需要后续前端迁移才能使用 v2 表。

### 在现有 Supabase 项目中重置并导入示例

1. 在 Supabase Dashboard → SQL Editor 执行 `supabase/reset-v2.sql`。这只删除 v2 表，不删除现有 v1 的 `trip_documents` 数据。
2. 执行 `supabase/schema-v2.sql`。
3. 在本机 `.env` 中临时加入 `SUPABASE_SERVICE_ROLE_KEY`。这个 key 只能用于本地脚本，绝对不要放入 Vite 的 `VITE_*` 变量、前端代码或 Git。
4. 可选地设置 `SUPABASE_SEED_OWNER_ID` 为 Supabase Auth 用户 UUID。
5. 执行：

```bash
npm run seed:v2
```

也可以导入其他 JSON 文件：

```bash
npm run seed:v2 -- seed/another-trip.json
```

脚本会按 Slug 删除已有的同名 v2 行程，再重新插入完整数据。默认 Slug 来自文件名，也可以用 `SUPABASE_SEED_SLUG` 覆盖。

> `supabase/reset-all.sql` 会同时删除 v1 和 v2 表。当前 React 界面仍依赖 v1，因此在前端迁移完成前不要执行它；迁移完成后才用它进行真正的全新数据库重置。

### Supabase Auth 免费层

截至 2026 年 8 月，Supabase Free 计划包含 50,000 MAU、匿名登录、OAuth、50 万 MB 数据库容量、1 GB Storage、5 GB egress、2 百万 Realtime 消息和 200 个并发连接。这个家庭旅行应用目前可以使用免费层；需要留意 Free 项目闲置一周后可能暂停，且每个组织最多 2 个活跃 Free 项目。价格和配额以 [Supabase Pricing](https://supabase.com/pricing) 为准。
