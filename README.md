# 东成果业项目

这是东成果业的整合仓库，包含前端/小程序源码和后端源码。

## 目录说明

```text
miniapp/
```

uni-app 前端源码，用于开发 H5 网页、微信小程序和 APP。服务器运行时不需要这个目录，网页端只上传 H5 打包产物。

```text
dcgy_server_publish/
```

后端源码，用于订单、库存、超市订单、利润、打印、OCR 等 API。服务器运行的是这个目录构建后的 `.output`。

```text
dcgy_keys/
```

本地证书目录，不提交 GitHub，不上传服务器。

## 服务器目录

```text
/www/wwwroot/dcgy_repo/dcgy
```

源码目录，只用于 `git pull` 更新代码，不对外访问。

```text
/www/wwwroot/dcgy
```

后端运行目录，PM2 跑这里。这里的 `.env` 是服务器真实配置，不要删除，不要覆盖。

```text
/www/wwwroot/dcgy_web
```

网页端运行目录，只放 H5 打包后的 `index.html`、`static` 等文件，不放 `miniapp` 源码。

## 不要动的服务器配置

服务器已经部署好后，不要删除或覆盖这些内容：

```text
/www/wwwroot/dcgy/.env
宝塔/Nginx 网站配置
PM2 里的 dcgy 应用
/www/wwwroot/dcgy_web 线上网页文件
```

不要为了本地测试去改服务器配置，也不要为了服务器部署去反复手动改 `miniapp/config/api.js`。

## 本地和服务器接口切换

接口地址已经自动判断：

```text
本地 H5：localhost 或 127.0.0.1 -> http://localhost:3000/api
服务器 H5：http://43.136.124.239 -> 当前站点 /api
小程序开发版：默认走 http://localhost:3000/api
小程序体验版/正式版：默认走腾讯云 AnyService
```

固定配置在：

```text
miniapp/config/api.js
```

正常情况下不要手动改它。服务器网页接口不通时，先查：

```bash
curl http://127.0.0.1:3000/api/health
curl http://43.136.124.239/api/health
```

第一个通、第二个不通，是 Nginx `/api/` 代理问题。第一个不通，是 PM2 后端没跑起来。

## 后端更新

```bash
cd /www/wwwroot/dcgy_repo/dcgy
git pull

cd dcgy_server_publish
npm install
npm run build

rsync -a --delete \
  .output \
  ecosystem.config.cjs \
  package.json \
  package-lock.json \
  prisma \
  prisma.config.ts \
  /www/wwwroot/dcgy/

cd /www/wwwroot/dcgy
npm install --omit=dev --ignore-scripts

set -a
source .env
set +a

cd /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish
npx prisma db push

pm2 restart dcgy --update-env
```

上面的 `rsync` 只同步列出的后端构建文件，不会删除 `/www/wwwroot/dcgy/.env`。

## 前端网页更新

本地 HBuilderX：

```text
打开 miniapp
发行 -> 网站-H5手机版
```

上传这个目录里面的所有文件：

```text
E:\project\dcgy\miniapp\unpackage\dist\build\h5\
```

覆盖到服务器：

```text
/www/wwwroot/dcgy_web
```

最终服务器应该是：

```text
/www/wwwroot/dcgy_web/index.html
/www/wwwroot/dcgy_web/static/...
```

不要上传成：

```text
/www/wwwroot/dcgy_web/h5/index.html
```

## 服务器能删什么

如果服务器源码目录已经完整 clone 了仓库，`/www/wwwroot/dcgy_repo/dcgy/miniapp` 可以不用于运行，但不要手动乱删后再 `git pull`。想让服务器源码目录不保留 `miniapp`，用 sparse checkout：

```bash
cd /www/wwwroot/dcgy_repo/dcgy
git sparse-checkout init --cone
git sparse-checkout set dcgy_server_publish README.md .gitignore AGENTS.md
git pull
```

可以清理这些临时依赖和构建缓存：

```bash
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/node_modules
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/.output
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/.nitro
```

不要删除：

```text
/www/wwwroot/dcgy/.env
/www/wwwroot/dcgy/.output
/www/wwwroot/dcgy_web
宝塔/Nginx 配置
PM2 配置
```
