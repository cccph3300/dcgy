SET @partial_payment_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'supermarket_orders'
    AND column_name = 'partial_payment'
);

SET @ddl := IF(
  @partial_payment_column_exists = 0,
  'ALTER TABLE `supermarket_orders` ADD COLUMN `partial_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @paid_at_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'supermarket_orders'
    AND column_name = 'paid_at'
);

SET @ddl := IF(
  @paid_at_column_exists = 0,
  'ALTER TABLE `supermarket_orders` ADD COLUMN `paid_at` DATETIME NULL AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `supermarket_accounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `partial_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total_debt` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supermarket_accounts_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `supermarket_accounts` (`name`, `total_debt`)
SELECT
  `supermarket_name`,
  COALESCE(SUM(CASE WHEN `status` = 'active' THEN `total_amount` ELSE 0 END), 0)
FROM `supermarket_orders`
GROUP BY `supermarket_name`;

UPDATE `supermarket_accounts` account
JOIN (
  SELECT
    `supermarket_name`,
    COALESCE(SUM(CASE WHEN `status` = 'active' THEN `total_amount` ELSE 0 END), 0) AS `total_debt`
  FROM `supermarket_orders`
  GROUP BY `supermarket_name`
) debt ON debt.`supermarket_name` = account.`name`
SET account.`total_debt` = debt.`total_debt`;

CREATE TABLE IF NOT EXISTS `supermarket_payment_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `supermarket_account_id` INT NOT NULL,
  `supermarket_name` VARCHAR(80) NOT NULL,
  `staff_id` INT NOT NULL,
  `staff_name` VARCHAR(40) NOT NULL,
  `order_id` INT NULL,
  `order_no` VARCHAR(24) NULL,
  `order_created_at` DATETIME NULL,
  `action` ENUM('supermarket_partial_payment', 'order_partial_payment', 'order_pay_off') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `unpaid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `supermarket_payment_records_account_id_created_at_idx` (`supermarket_account_id`, `created_at`),
  KEY `supermarket_payment_records_staff_id_idx` (`staff_id`),
  KEY `supermarket_payment_records_order_id_idx` (`order_id`),
  CONSTRAINT `supermarket_payment_records_account_id_fkey` FOREIGN KEY (`supermarket_account_id`) REFERENCES `supermarket_accounts` (`id`),
  CONSTRAINT `supermarket_payment_records_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_users` (`id`),
  CONSTRAINT `supermarket_payment_records_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `supermarket_orders` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
