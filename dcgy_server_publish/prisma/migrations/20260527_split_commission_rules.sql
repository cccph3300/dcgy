ALTER TABLE `goods`
  ADD COLUMN `sale_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `default_commission`;

ALTER TABLE `supplier_entries`
  ADD COLUMN `sale_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `commission`;

ALTER TABLE `order_items`
  ADD COLUMN `cost_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `commission`;

ALTER TABLE `supermarket_order_items`
  ADD COLUMN `cost_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `commission`;

ALTER TABLE `retail_products`
  ADD COLUMN `cost_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `cost_price`;

ALTER TABLE `retail_order_items`
  ADD COLUMN `cost_commission` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `commission`;

UPDATE `order_items` oi
JOIN `goods` g ON g.`id` = oi.`goods_id`
SET oi.`cost_commission` = g.`default_commission`
WHERE oi.`cost_commission` = 0;

UPDATE `supermarket_order_items` soi
JOIN `goods` g ON g.`id` = soi.`goods_id`
SET soi.`cost_commission` = g.`default_commission`
WHERE soi.`type` = 'own' AND soi.`cost_commission` = 0;

UPDATE `retail_products` rp
JOIN `goods` g ON g.`id` = rp.`goods_id`
SET rp.`cost_commission` = g.`default_commission`
WHERE rp.`source_type` = 'stock' AND rp.`cost_commission` = 0;

UPDATE `retail_order_items` roi
JOIN `retail_products` rp ON rp.`id` = roi.`product_id`
SET roi.`cost_commission` = rp.`cost_commission`
WHERE roi.`cost_commission` = 0;

UPDATE `order_items` oi
SET oi.`profit` = ROUND(
  oi.`subtotal` - (
    CASE
      WHEN oi.`unit_type` = 'weight' THEN COALESCE(oi.`weight`, 0) * oi.`cost_price`
      ELSE oi.`quantity` * oi.`cost_price`
    END
  ) - oi.`quantity` * oi.`cost_commission`,
  2
);

UPDATE `orders` o
JOIN (
  SELECT `order_id`, ROUND(SUM(`profit`), 2) AS `profit_amount`
  FROM `order_items`
  GROUP BY `order_id`
) item_totals ON item_totals.`order_id` = o.`id`
SET o.`profit_amount` = item_totals.`profit_amount`;

UPDATE `supermarket_order_items`
SET `profit` = ROUND(`subtotal` - `cost_amount` - `quantity` * `cost_commission`, 2);

UPDATE `supermarket_orders` so
JOIN (
  SELECT `order_id`, ROUND(SUM(`profit`), 2) AS `total_profit`
  FROM `supermarket_order_items`
  GROUP BY `order_id`
) item_totals ON item_totals.`order_id` = so.`id`
SET so.`total_profit` = item_totals.`total_profit`;

UPDATE `retail_order_items`
SET `profit` = ROUND(`subtotal` - `cost_amount` - `quantity` * `cost_commission`, 2);

UPDATE `retail_orders` ro
JOIN (
  SELECT `order_id`, ROUND(SUM(`profit`), 2) AS `total_profit`
  FROM `retail_order_items`
  GROUP BY `order_id`
) item_totals ON item_totals.`order_id` = ro.`id`
SET ro.`total_profit` = item_totals.`total_profit`;
