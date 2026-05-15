UPDATE `order_items` oi
JOIN `goods` g ON g.`id` = oi.`goods_id`
SET
  oi.`cost_price` = g.`cost_price`,
  oi.`profit` = ROUND(
    oi.`subtotal`
    - CASE
      WHEN oi.`unit_type` = 'weight' THEN COALESCE(oi.`weight`, 0) * g.`cost_price`
      ELSE oi.`quantity` * g.`cost_price`
    END
    - oi.`commission`,
    2
  )
WHERE oi.`cost_price` = 0 AND oi.`profit` = 0;

UPDATE `orders` o
JOIN (
  SELECT `order_id`, ROUND(SUM(`profit`), 2) AS `profit_amount`
  FROM `order_items`
  GROUP BY `order_id`
) p ON p.`order_id` = o.`id`
SET o.`profit_amount` = p.`profit_amount`
WHERE o.`profit_amount` = 0;
