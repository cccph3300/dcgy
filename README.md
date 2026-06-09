# 东成果业项目

整合仓库，包含：

- `miniapp/`：uni-app 前端，支持 H5、微信小程序、APP。
- `dcgy_server_publish/`：后端 API，负责订单、库存、利润、打印、OCR 等能力。
- `dcgy_keys/`：本地证书目录，不提交、不上传。

## 服务器目录

```text
/www/wwwroot/dcgy_repo/dcgy   源码目录，只用于 git pull 和构建
/www/wwwroot/dcgy             后端运行目录，PM2 跑这里
/www/wwwroot/dcgy_web         H5 网页目录，只放打包产物
```

不要覆盖：

- `/www/wwwroot/dcgy/.env`
- `/www/wwwroot/dcgy/.output`
- `/www/wwwroot/dcgy_web`
- 宝塔/Nginx 配置
- PM2 的 `dcgy` 应用

## 后端更新

原则：

- 先确认 `git pull` 成功，再构建和重启。
- 如果 `git pull` 报本地文件会被覆盖，不要继续 `npm run build`，否则构建的还是旧代码。
- 服务器上的临时改动先备份，再还原或 stash，不能直接覆盖不明改动。

### 1. 拉取代码

```bash
cd /www/wwwroot/dcgy_repo/dcgy
git status --short --branch
git pull --ff-only
```

正常情况应该能直接拉取成功。

如果看到类似下面的提示，说明服务器有本地改动挡住了更新：

```text
Your local changes to the following files would be overwritten by merge
Aborting
```

先备份并暂存本地改动，再重新拉取：

```bash
cd /www/wwwroot/dcgy_repo/dcgy

BACKUP=/root/dcgy-backup-$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP"
git status --short > "$BACKUP/git-status.txt"

git stash push -u -m "server-before-pull-$(date +%Y%m%d-%H%M%S)"
git pull --ff-only
```

如果只是不需要保留的单个文件改动，也可以先确认已备份，再还原指定文件：

```bash
git restore --source=HEAD --staged --worktree dcgy_server_publish/prisma/schema.prisma
git pull --ff-only
```

### 2. 构建后端

```bash
cd dcgy_server_publish
npm install
npm run build
npm run db:apply:order-adjustments
npm run db:apply:supermarket-order-adjustments
npm run db:generate
```

不要在生产库使用 `prisma db push` 代替迁移 SQL。

### 3. 同步运行目录并重启

```bash
cd /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish

rsync -a --delete \
  .output \
  ecosystem.config.cjs \
  package.json \
  package-lock.json \
  prisma \
  prisma.config.ts \
  /www/wwwroot/dcgy/

cd /www/wwwroot/dcgy
pm2 restart dcgy --update-env
pm2 save
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
curl http://43.136.124.239/api/health
```

第一个不通，查 PM2 后端；第一个通、第二个不通，查 Nginx `/api/` 代理。

如果某个新接口本地正常、服务器报 `Cannot find any route matching`，优先检查服务器是否拉到新代码：

```bash
cd /www/wwwroot/dcgy_repo/dcgy
git status --short --branch
git log -1 --oneline
```

再检查运行目录的接口是否已经进入构建产物：

```bash
grep -n "route: '/api/接口路径'" /www/wwwroot/dcgy/.output/server/chunks/_/nitro.mjs
curl -i http://127.0.0.1:3000/api/接口路径
```

返回 `401` 或业务数据，说明接口存在；返回 `Cannot find any route matching`，说明运行中的后端包还是旧的。

## H5 更新

在 HBuilderX 中打开 `miniapp`：

```text
发行 -> 网站-H5手机版
```

上传本地打包目录内的所有文件：

```text
E:\project\dcgy\miniapp\unpackage\dist\build\h5\
```

覆盖到服务器：

```text
/www/wwwroot/dcgy_web
```

最终结构应为：

```text
/www/wwwroot/dcgy_web/index.html
/www/wwwroot/dcgy_web/static/...
```

不要上传成 `/www/wwwroot/dcgy_web/h5/index.html`。

## 接口地址

配置文件：

```text
miniapp/config/api.js
```

默认规则：

- 本地 H5、小程序开发版：`http://localhost:3000`
- 服务器 H5：当前站点 `/api`
- 小程序体验版/正式版：腾讯云 AnyService
- APP：服务器地址

正常部署不要反复手动改接口地址。
