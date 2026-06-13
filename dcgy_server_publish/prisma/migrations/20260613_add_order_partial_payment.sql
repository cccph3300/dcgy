SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'partial_payment'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `orders` ADD COLUMN `partial_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_amount`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
