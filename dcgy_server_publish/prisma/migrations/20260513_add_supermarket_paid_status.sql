ALTER TABLE `supermarket_orders`
  MODIFY `status` ENUM('active', 'paid', 'cancelled') NOT NULL DEFAULT 'active';
