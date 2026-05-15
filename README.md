# 东成果业项目

这是东成果业的整合仓库，包含前端/小程序源码和后端源码。

## 目录说明

```text
miniapp/
```

uni-app 前端源码，用于开发 H5 网页、微信小程序和 APP。服务器不直接运行这个目录，网页端只需要上传 H5 打包产物。

```text
dcgy_server_publish/
```

后端源码，用于订单、库存、超市订单、利润、打印、OCR 等 API。服务器运行的是该目录构建后的 `.output` 产物。

```text
dcgy_keys/
```

本地证书目录，不提交 GitHub，不上传普通服务器目录。

## 服务器目录约定

```text
/www/wwwroot/dcgy_repo/dcgy
```

服务器源码目录，用于 `git pull` 拉取本仓库最新代码。

```text
/www/wwwroot/dcgy
```

后端运行目录，只放后端构建产物和运行配置，PM2 在这里启动。

```text
/www/wwwroot/dcgy_web
```

网页端目录，只放 H5 打包后的 `index.html`、`static` 等文件。

## 更新方式

后端更新：

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

前端网页更新：

```text
HBuilderX 打开 miniapp
发行 -> 网站-H5手机版
上传 miniapp/unpackage/dist/build/h5/ 里面的所有文件到 /www/wwwroot/dcgy_web
```

注意不要上传整个 `miniapp` 源码到网页目录，只上传 H5 打包产物。

配置完成:
```bash
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/node_modules
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/.output
rm -rf /www/wwwroot/dcgy_repo/dcgy/dcgy_server_publish/.nitro
```