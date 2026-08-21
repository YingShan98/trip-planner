# Trip Planner — 通用多人协作旅行规划器

一个 **mobile-first、Supabase Auth、角色协作、可撤销安全分享、Realtime 同步** 的旅行规划器。

适合家庭、朋友、多人旅行团共同规划。一个 Supabase 项目可以保存很多旅行：广州、韩国、日本、欧洲……都可以复用。

## 功能

- 多旅行管理：创建、复制、删除、打开不同旅行
- 分享查看：持有效分享链接即可查看，无需登录
- Auth 协作：拥有者、编辑者、查看者角色
- 安全分享：随机 token、哈希存储、可撤销、可过期的只读链接
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

## 2. 初始化和迁移数据库

安装 Supabase CLI，然后在项目根目录登录并关联项目：

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

首次安装或本地开发数据库重置：

```bash
npm run db:reset
```

将本地迁移应用到已关联的 Supabase 项目：

```bash
npm run db:push
```

GitHub Actions 也会在每次推送到 `main` 时，先执行数据库迁移，成功后才部署 GitHub Pages。也可以在 GitHub → Actions → **Migrate Supabase database** → **Run workflow** 手动执行迁移。

在 repository secrets 中配置以下值：

- `SUPABASE_ACCESS_TOKEN`：Supabase personal access token
- `SUPABASE_DB_PASSWORD`：Supabase database password
- `SUPABASE_PROJECT_REF`：Supabase 项目 ref，例如 `abcdefghijklmnopqrst`

所有后续数据库变更都必须新增 `supabase/migrations/<timestamp>_<name>.sql`，不要修改已经执行过的迁移。Supabase CLI 不会根据实体或 SQL 的修改自动生成 migration 文件；修改表结构后，需要手动创建并提交迁移：

```bash
npx supabase migration new describe-your-change
```

编辑生成的 SQL 后，先用 `npm run db:reset` 在本地验证，再提交并推送。`supabase/schema.sql` 仍是完整的手动安装/参考脚本；正常升级使用迁移命令，不需要删除数据。

不要对有数据的远程项目运行 `npm run db:reset`。只有需要清空整个项目时，才在 SQL Editor 执行 `supabase/reset-fresh.sql`，然后重新执行迁移。

这些脚本会创建：

- `trips`、`trip_days`、`activities` 等规范化表
- `trip_members`：拥有者、编辑者、查看者
- `trip_shares`：哈希 token 分享链接
- `trip_guest_identities` 和 `trip_edit_events`：访客身份与编辑记录
- RLS policies 和事务保存 RPC
- Realtime publication

## 3. 配置前端

复制：

```text
.env.example → .env
```

填写 Supabase Dashboard → Project Settings → API 中的：

- Project URL → `VITE_SUPABASE_URL`
- Publishable key / anon public key → `VITE_SUPABASE_KEY`
- hCaptcha site key → `VITE_HCAPTCHA_SITE_KEY`

`.env` 已加入 `.gitignore`，所以不会被 Git 提交。这些值在构建时会被 Vite 打包进前端代码。

**anon/publishable key 可以出现在前端；Database Password、service_role key 绝对不要放进前端。**

在 Supabase Dashboard 的 **Authentication → Providers → CAPTCHA** 中启用 hCaptcha，并配置与前端对应的 site key 和 secret。前端只使用 site key；hCaptcha secret 只保留在 Supabase。匿名访客编辑会在提交编辑权限时执行 invisible hCaptcha，并将 token 交给 Supabase Auth 验证。

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
   - `VITE_HCAPTCHA_SITE_KEY`
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

先使用 Supabase Auth 注册或登录，再点击「＋ 新建行程」。创建者自动成为旅行拥有者。

## 7. 导入现有广州行程

仓库提供：

```text
seed/guangzhou-family-trip-2027.json
```

部署完成后登录 Trip Planner，使用「导入 JSON」即可载入已有广州行程数据。导入会创建一趟新的规范化旅行，不需要 service-role key 或本地 seed 脚本。

## 安全说明

前端只使用 publishable/anon key。所有写入由 Supabase Auth 和 RLS 保护。service-role key 不需要放入本项目或部署环境。

## 数据库结构（规范化 schema）

`supabase/migrations` 是数据库变更的版本记录，包含表、RLS、角色权限、事务保存和安全分享 RPC。当前迁移会保留已有旅行数据，并加入访客身份与编辑历史能力。

### 在现有 Supabase 项目中重置并导入示例

1. 按上面的 CLI 流程执行 `npm run db:push`。
2. 部署前端并登录 Auth 账户。
3. 在首页点击「导入 JSON」，选择 `seed/guangzhou-family-trip-2027.json`。
4. 填写旅行 Slug 后创建，导入内容会通过正常的 Auth/RLS 写入流程保存。


### Supabase Auth 免费层

截至 2026 年 8 月，Supabase Free 计划包含 50,000 MAU、匿名登录、OAuth、50 万 MB 数据库容量、1 GB Storage、5 GB egress、2 百万 Realtime 消息和 200 个并发连接。这个家庭旅行应用目前可以使用免费层；需要留意 Free 项目闲置一周后可能暂停，且每个组织最多 2 个活跃 Free 项目。价格和配额以 [Supabase Pricing](https://supabase.com/pricing) 为准。
