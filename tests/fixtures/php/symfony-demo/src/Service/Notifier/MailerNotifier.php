<?php
declare(strict_types=1);

namespace App\Service\Notifier;

use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Security\Core\User\UserInterface;

final class MailerNotifier
{
    public function __construct(
        private readonly MailerInterface $mailer,
    ) {
    }

    public function notify(?UserInterface $user): void
    {
        if ($user === null) {
            return;
        }

        $message = (new Email())
            ->subject('New dashboard visit')
            ->to('ops@example.com')
            ->text(sprintf('User %s just opened the dashboard.', $user->getUserIdentifier()));

        $this->mailer->send($message);
    }
}
