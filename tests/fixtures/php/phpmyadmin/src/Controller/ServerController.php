<?php
declare(strict_types=1);

namespace PhpMyAdmin\Controller;

use PhpMyAdmin\Libraries\ServerStatus;
use Symfony\Component\HttpFoundation\JsonResponse;

final class ServerController
{
    public function __construct(
        private readonly ServerStatus $status,
    ) {
    }

    public function status(): JsonResponse
    {
        return new JsonResponse([
            'uptime' => $this->status->getUptime(),
        ]);
    }
}
