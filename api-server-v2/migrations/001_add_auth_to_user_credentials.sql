-- Add login and role columns to user_credentials for dashboard auth.
-- Run this against your database before using the login system.

ALTER TABLE `user_credentials`
  ADD COLUMN `email` VARCHAR(255) NULL UNIQUE AFTER `id_cr`,
  ADD COLUMN `password_hash` VARCHAR(255) NULL AFTER `email`,
  ADD COLUMN `role` ENUM('user','super_admin') NOT NULL DEFAULT 'user' AFTER `password_hash`;

-- After running this, set email and password_hash for each user (e.g. via a script or admin tool).
-- For super admin: UPDATE user_credentials SET email = 'your@email.com', password_hash = '<bcrypt-hash>', role = 'super_admin' WHERE id_cr = 1;
