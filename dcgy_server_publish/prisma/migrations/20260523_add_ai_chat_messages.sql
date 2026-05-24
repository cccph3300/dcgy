CREATE TABLE `ai_chat_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `staff_id` INT NOT NULL,
  `role` ENUM('user', 'assistant') NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ai_chat_messages_staff_id_id_idx` (`staff_id`, `id`),
  KEY `ai_chat_messages_staff_id_created_at_idx` (`staff_id`, `created_at`),
  CONSTRAINT `ai_chat_messages_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `staff_users`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
