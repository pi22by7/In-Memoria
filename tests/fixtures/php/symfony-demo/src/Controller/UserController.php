<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;

final class UserController
{
    public function show(int $id): JsonResponse
    {
        return new JsonResponse(['id' => $id, 'name' => 'Symfony Demo']);
    }
}
