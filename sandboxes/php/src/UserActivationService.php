<?php
declare(strict_types=1);

namespace App\Service;

use App\Repository\UserRepository;

final class UserActivationService
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly EmailNotifier $notifier,
    ) {
    }

    public function activateUser(int $id): bool
    {
        $user = $this->repository->find($id);
        if ($user === null) {
            return false;
        }

        $user->activate();
        $this->notifier->sendActivation($user);

        return true;
    }
}
