<?php
declare(strict_types=1);

namespace App\Service;

use App\Model\User;

final class EmailNotifier
{
    public function __construct(private readonly AuditLogger $logger)
    {
    }

    public function sendActivation(User $user): void
    {
        $this->logger->info('Sent activation email', [
            'userId' => $user->id(),
            'email' => $user->email(),
        ]);
    }
}
