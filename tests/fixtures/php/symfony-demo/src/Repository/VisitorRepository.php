<?php
declare(strict_types=1);

namespace App\Repository;

use App\Service\Notifier\MailerNotifier;
use Doctrine\DBAL\Connection;

final class VisitorRepository
{
    public function __construct(
        private readonly Connection $connection,
        private readonly MailerNotifier $notifier,
    ) {
    }

    public function record(string $identifier): void
    {
        $this->connection->insert('visitor_log', [
            'user_identifier' => $identifier,
            'visited_at' => (new \DateTimeImmutable())->format('Y-m-d H:i:s'),
        ]);

        $this->notifier->notify(null);
    }
}
