# 水果点单小程序端

## 上线前接口配置

1. 后端必须能通过 HTTPS 域名访问，例如 `https://api.example.com`。
2. 打开 `config/api.js`，把 `API_BASE` 改成你的 HTTPS 域名。
3. 在微信公众平台的小程序后台，把同一个域名加入“开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名”。
4. 正式版不能使用 IP、`localhost`、`127.0.0.1` 或 HTTP 地址。

## 运行方式

1. 使用 HBuilderX 打开当前 `miniapp` 目录。
2. 在 `manifest.json` 填入微信小程序 `appid`。
3. 选择“运行到小程序模拟器 -> 微信开发者工具”。
4. 真机测试前确认后端域名已配置 HTTPS 和 request 合法域名。

## 后端接口要求

- 登录：`POST /api/auth/login`，返回 `token` 和店员信息。
- 当前店员：`GET /api/auth/me`。
- 货物库存：`GET /api/goods`、`POST /api/goods`、`PATCH /api/goods/:id`、`DELETE /api/goods/:id`。
- 订单：`GET /api/orders`、`POST /api/orders`、`GET /api/orders/:id`。
- 订单操作：`PATCH /api/orders/:id/pay`、`PATCH /api/orders/:id/cancel`、`DELETE /api/orders/:id`。
- 小程序请求会自动携带 `Authorization: Bearer token`。

## 页面

- `pages/order/index`：点单首页。
- `pages/orders/index`：订单列表，默认当天订单。
- `pages/orders/detail`：订单详情、已付清、毁单、删除。
- `pages/inventory/index`：库存搜索、入库、编辑、删除。

## 打包
	Android包名：
	com.dcgy.order

	证书别名：
	dcgy

	证书私钥密码：
	aoD2ji6c1Ai5ODa5zvmAUOeY9a

	证书文件：
	E:/project/dcgy/dcgy_keys/dcgy-release.keystore
