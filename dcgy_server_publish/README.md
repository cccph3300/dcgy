# 东成果业后端

后端 API 服务，技术栈：Nitro、Prisma、MySQL、PM2。

## 本地构建

```bash
npm install
npm run build
```

部署只需要上传：

- `.output/`
- `ecosystem.config.cjs`
- 生产环境 `.env`

不要上传项目根目录的 `node_modules`。

## 数据库更新

在源码目录执行：

```bash
npm install
npm run db:apply:order-adjustments
npm run db:apply:supermarket-order-adjustments
npm run db:generate
```

不要在生产库使用 `prisma db push` 代替迁移 SQL。

## 服务更新

```bash
cd /www/wwwroot/dcgy
pm2 restart dcgy --update-env
pm2 save
```

首次启动：

```bash
cd /www/wwwroot/dcgy
pm2 start ecosystem.config.cjs
pm2 save
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

## 环境变量

生产环境 `.env` 至少包含：

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

不要提交真实 `.env`。
