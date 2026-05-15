ALTER TABLE `orders`
  ADD COLUMN `profit_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_amount`;

ALTER TABLE `order_items`
  ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `subtotal`,
  ADD COLUMN `profit` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `cost_price`;
