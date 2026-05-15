# 东成果业服务器端

这是水果批发点单系统的服务器专用仓库，只保留后端 API、Prisma、MySQL 和打印接口相关代码。

网页端页面已移除。访问根路径会返回服务状态；小程序继续调用 `/api/*` 接口。

## 本地构建

开发机或 CI 上构建：

```bash
npm install
npm run build
```

构建后只需要部署 `.output` 目录、`ecosystem.config.cjs` 和生产环境 `.env`。不要把项目根目录的 `node_modules` 上传到服务器。

## 服务器轻量部署

服务器只运行构建产物，不在服务器安装 Nuxt/Nitro/Vite 等构建依赖。把本地构建出来的 `.output` 上传到 `/www/wwwroot/dcgy` 后执行：

```bash
cd /www/wwwroot/dcgy
pm2 start ecosystem.config.cjs
pm2 save
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

第一次部署需要初始化数据库时，在源码目录执行：

```bash
npm install
npx prisma db push
```

PM2 启动：

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

更新服务：

```bash
cd /www/wwwroot/dcgy
pm2 restart dcgy --update-env
```

如果选择在服务器源码目录直接 `npm install && npm run build`，服务器仍会下载构建依赖，这是正常的。想少下载依赖，就在本地或 CI 构建后只上传 `.output`。

## 环境变量

生产环境必须配置：

```text
DATABASE_URL=mysql://用户名:密码@127.0.0.1:3306/数据库名
SESSION_SECRET=一串随机密钥
XPYUN_USER=芯烨云账号
XPYUN_USER_KEY=芯烨云UserKEY
XPYUN_SN=打印机SN
XPYUN_COPIES=1
XPYUN_MODE=0
XPYUN_PAYMENT_QR=微信或支付宝收款码内容，可不填
```

不要把真实 `.env` 提交到 GitHub。 
## 生成密码
node -e "const {createHash}=require('crypto'); console.log(createHash('sha256').update('dcgy:123456').digest('hex'))"
