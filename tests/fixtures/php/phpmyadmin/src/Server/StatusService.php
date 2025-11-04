<?php
declare(strict_types=1);

namespace PhpMyAdmin\Server;

final class StatusService
{
    public function formatUptime(): string
    {
        $seconds = (int) (microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']);
        $hours = (int) floor($seconds / 3600);
        $minutes = (int) floor(($seconds % 3600) / 60);
        return sprintf('%dh %dm', $hours, $minutes);
    }
}
