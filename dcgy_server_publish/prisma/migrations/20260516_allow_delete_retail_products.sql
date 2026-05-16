ALTER TABLE `retail_order_items`
  DROP FOREIGN KEY `retail_order_items_product_id_fkey`;

ALTER TABLE `retail_order_items`
  MODIFY COLUMN `product_id` INT DEFAULT NULL;

ALTER TABLE `retail_order_items`
  ADD CONSTRAINT `retail_order_items_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `retail_products` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
