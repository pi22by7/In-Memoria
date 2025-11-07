<?php
declare(strict_types=1);

namespace App\Service;

use App\Model\User;
use App\Repository\UserRepository;

final class UserService
{
    public function __construct(
        private readonly AuditLogger $logger,
        private readonly UserRepository $repository,
    ) {
    }

    public function findUser(int $id): ?User
    {
        if ($id <= 0) {
            $this->logger->warn('Invalid user id', ['id' => $id]);
            return null;
        }

        $user = $this->repository->find($id);
        if ($user === null) {
            $this->logger->info('User not found', ['id' => $id]);
        }

        return $user;
    }
}
