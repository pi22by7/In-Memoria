<?php
declare(strict_types=1);

namespace App\Service\Notifier;

use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

final class SlackNotifier
{
    public function __construct(
        private readonly LoggerInterface $logger,
    ) {
    }

    public function notify(?UserInterface $user): void
    {
        $this->logger->info('Sending Slack notification for dashboard visit', [
            'user' => $user?->getUserIdentifier(),
        ]);
    }
}
