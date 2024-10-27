-- CreateTable
CREATE TABLE `database_credentials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `host` VARCHAR(255) NOT NULL,
    `usuario` VARCHAR(255) NOT NULL,
    `senha` VARCHAR(255) NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `database_credentials` ADD CONSTRAINT `database_credentials_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
