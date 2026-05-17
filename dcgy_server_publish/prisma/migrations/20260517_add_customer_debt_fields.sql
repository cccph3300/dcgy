ALTER TABLE `customers`
  ADD COLUMN `total_debt` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `partial_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE `customers` c
LEFT JOIN (
  SELECT `customer_id`, ROUND(COALESCE(SUM(`total_amount`), 0), 2) AS `debt_amount`
  FROM `orders`
  WHERE `status` = 'unpaid'
  GROUP BY `customer_id`
) d ON d.`customer_id` = c.`id`
SET c.`total_debt` = COALESCE(d.`debt_amount`, 0),
    c.`partial_payment` = LEAST(c.`partial_payment`, COALESCE(d.`debt_amount`, 0));
