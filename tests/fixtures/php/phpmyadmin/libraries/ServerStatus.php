<?php
declare(strict_types=1);

namespace PhpMyAdmin\Libraries;

use PhpMyAdmin\Server\StatusService;

final class ServerStatus
{
    public function __construct(
        private readonly StatusService $service,
    ) {
    }

    public function getUptime(): string
    {
        return $this->service->formatUptime();
    }
}
