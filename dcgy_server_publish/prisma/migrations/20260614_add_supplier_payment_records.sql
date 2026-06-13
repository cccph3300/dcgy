SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'supplier_entries'
    AND column_name = 'partial_payment'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `supplier_entries` ADD COLUMN `partial_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `supplier_payment_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `supplier_id` INT NOT NULL,
  `supplier_name` VARCHAR(80) NOT NULL,
  `staff_id` INT NOT NULL,
  `staff_name` VARCHAR(40) NOT NULL,
  `entry_id` INT NULL,
  `entry_no` VARCHAR(24) NULL,
  `entry_created_at` DATETIME NULL,
  `action` ENUM('supplier_partial_payment', 'entry_partial_payment', 'entry_pay_off') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `unpaid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `supplier_payment_records_supplier_id_created_at_idx` (`supplier_id`, `created_at`),
  KEY `supplier_payment_records_staff_id_idx` (`staff_id`),
  KEY `supplier_payment_records_entry_id_idx` (`entry_id`),
  CONSTRAINT `supplier_payment_records_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `supplier_payment_records_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_users` (`id`),
  CONSTRAINT `supplier_payment_records_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `supplier_entries` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
