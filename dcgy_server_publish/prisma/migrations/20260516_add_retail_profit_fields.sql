ALTER TABLE `retail_products`
  ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `price`;

ALTER TABLE `retail_orders`
  ADD COLUMN `total_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `total_amount`,
  ADD COLUMN `total_profit` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `total_cost`;

ALTER TABLE `retail_order_items`
  ADD COLUMN `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `price`,
  ADD COLUMN `cost_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `cost_price`,
  ADD COLUMN `profit` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `cost_amount`;

UPDATE `retail_products` rp
LEFT JOIN `goods` g ON g.`id` = rp.`goods_id`
SET rp.`cost_price` = COALESCE(g.`cost_price`, 0)
WHERE rp.`source_type` = 'stock' AND rp.`cost_price` = 0;

UPDATE `retail_order_items` roi
LEFT JOIN `retail_products` rp ON rp.`id` = roi.`product_id`
SET
  roi.`cost_price` = COALESCE(rp.`cost_price`, 0),
  roi.`cost_amount` = ROUND(
    CASE
      WHEN roi.`unit_type` = 'weight' THEN COALESCE(roi.`weight`, 0) * COALESCE(rp.`cost_price`, 0)
      ELSE roi.`quantity` * COALESCE(rp.`cost_price`, 0)
    END,
    2
  ),
  roi.`profit` = ROUND(
    roi.`subtotal` - (
      CASE
        WHEN roi.`unit_type` = 'weight' THEN COALESCE(roi.`weight`, 0) * COALESCE(rp.`cost_price`, 0)
        ELSE roi.`quantity` * COALESCE(rp.`cost_price`, 0)
      END
    ) - roi.`commission`,
    2
  )
WHERE roi.`cost_price` = 0 AND roi.`cost_amount` = 0 AND roi.`profit` = 0;

UPDATE `retail_orders` ro
JOIN (
  SELECT
    `order_id`,
    ROUND(SUM(`cost_amount`), 2) AS `total_cost`,
    ROUND(SUM(`profit`), 2) AS `total_profit`
  FROM `retail_order_items`
  GROUP BY `order_id`
) item_totals ON item_totals.`order_id` = ro.`id`
SET
  ro.`total_cost` = item_totals.`total_cost`,
  ro.`total_profit` = item_totals.`total_profit`
WHERE ro.`total_cost` = 0 AND ro.`total_profit` = 0;
