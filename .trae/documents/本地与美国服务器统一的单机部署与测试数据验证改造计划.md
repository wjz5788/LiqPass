**目标**

* 单机（本地/美国服务器）用 Docker Compose 部署前端、后端、验证服务与 Nginx，统一入口与私网互通。

* 增加后端 `/mock/*` 只读路由，从项目内 `reports` 与 `reports/evidence` 读取测试数据 JSON。

* 前端页面增加“使用测试数据验证”入口，输入订单号即从 `/mock/orders/:id` 拉取并以 JSON 展示；赔付管理验证同样走测试数据。

**后端改造**

* 新增路由文件：`apps/us-backend/src/routes/mock.ts`。

* 端点：

  * `GET /mock/orders/:id` → 查找并返回 `reports/order_<id>_detailed_report.json` 或根目录 `order_<id>_detailed_report.json`。

  * `GET /mock/evidence/:dir/:file` → 返回 `reports/evidence/<dir>/<file>` 内容（CSV 文件直接文本返回）。

* 配置：`TEST_DATA_DIR` 支持自定义根路径，默认当前仓库；保持同源访问无需跨域。

**前端改造**

* `ApiSettings.tsx` 增加“使用测试数据验证”按钮：输入订单号后请求 `/mock/orders/:id` 并在抽屉/模态直接 JSON 展示。

* `ClaimsManage.tsx` 的验证按钮默认走测试数据端点，展开卡片展示订单详细与 evidence。

* 保持现有 JSON 视图组件和回显逻辑。

**部署与联调**

* 本地：使用 Compose 启动全部组件，验证生产与测试两种模式；测试数据路径使用仓库内 `reports/*`。

* 美国服务器：复制同一套 Compose 与 `.env`，挂载 `/opt/liqpass/test-data`（如需），Nginx 代理到后端与前端，TLS 证书配置后即对外演示。

**交付**

* 完成代码改造与本地联调，提供 Compose 与 Nginx 配置示例、环境变量清单；随后在服务器落地部署。

