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

```bash
cd /www/wwwroot/dcgy_repo/dcgy
git pull

cd dcgy_server_publish
npm install
npm run build
npm run db:apply:order-adjustments
npm run db:apply:supermarket-order-adjustments
npm run db:generate

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

不要在生产库使用 `prisma db push` 代替迁移 SQL。

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
curl http://43.136.124.239/api/health
```

第一个不通，查 PM2 后端；第一个通、第二个不通，查 Nginx `/api/` 代理。

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
