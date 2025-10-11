-- 清空数据库所有表数据的SQL脚本
-- 注意：此操作将删除所有数据，请确保已备份重要数据

-- 禁用外键约束检查
SET FOREIGN_KEY_CHECKS = 0;

-- 清空所有表数据（按依赖关系顺序）
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `webhooks`;
TRUNCATE TABLE `build_tasks`;
TRUNCATE TABLE `miniprogram_configs`;
TRUNCATE TABLE `miniprograms`;
TRUNCATE TABLE `git_credentials`;
TRUNCATE TABLE `notification_configs`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `system_configs`;

-- 重新启用外键约束检查
SET FOREIGN_KEY_CHECKS = 1;

-- 重置自增ID（如果需要）
ALTER TABLE `users` AUTO_INCREMENT = 1;
ALTER TABLE `git_credentials` AUTO_INCREMENT = 1;
ALTER TABLE `notification_configs` AUTO_INCREMENT = 1;
ALTER TABLE `miniprograms` AUTO_INCREMENT = 1;
ALTER TABLE `miniprogram_configs` AUTO_INCREMENT = 1;
ALTER TABLE `notifications` AUTO_INCREMENT = 1;
ALTER TABLE `webhooks` AUTO_INCREMENT = 1;
ALTER TABLE `system_configs` AUTO_INCREMENT = 1;