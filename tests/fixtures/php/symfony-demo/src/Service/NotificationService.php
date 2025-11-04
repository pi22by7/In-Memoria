<?php
declare(strict_types=1);

namespace App\Service;

use App\Service\Notifier\MailerNotifier;
use App\Service\Notifier\SlackNotifier;
use Symfony\Component\Security\Core\User\UserInterface;

final class NotificationService
{
    /**
     * @param iterable<MailerNotifier|SlackNotifier> $notifiers
     */
    public function __construct(
        private readonly iterable $notifiers,
    ) {
    }

    public function recordVisit(?UserInterface $user): void
    {
        foreach ($this->notifiers as $notifier) {
            $notifier->notify($user);
        }
    }
}
