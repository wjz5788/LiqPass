// 注意：better-sqlite3 的类型由 @types/better-sqlite3 提供（见 devDependencies）。
// 原先这里有一条 `declare module 'better-sqlite3';` 简写声明，会把该模块整体
// 退化成 any，正是它掩盖了 dao/ 与 models/ 里「用 node-sqlite3 回调风格调用
// 同步 API」的问题。
declare module 'swagger-ui-express';
declare module 'yamljs';
