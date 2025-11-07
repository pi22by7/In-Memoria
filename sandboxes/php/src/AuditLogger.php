<?php
declare(strict_types=1);

namespace App\Service;

interface AuditLogger
{
    /**
     * @param array<string, mixed> $context
     */
    public function info(string $message, array $context = []): void;

    /**
     * @param array<string, mixed> $context
     */
    public function warn(string $message, array $context = []): void;
}
