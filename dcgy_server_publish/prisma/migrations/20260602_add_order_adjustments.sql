SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'adjustment_remark'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `adjustment_remark` VARCHAR(100) NULL AFTER `profit_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `order_adjustments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` INT NOT NULL,
  `name` VARCHAR(30) NOT NULL,
  `type` ENUM('add', 'subtract') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_adjustments_order_id_idx` (`order_id`),
  CONSTRAINT `order_adjustments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
