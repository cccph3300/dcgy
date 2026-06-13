SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'customer_payment_records'
    AND column_name = 'unpaid_amount'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `customer_payment_records` ADD COLUMN `unpaid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `amount`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
