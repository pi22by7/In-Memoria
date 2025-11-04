<?php

declare(strict_types=1);

namespace App\Http\Controllers;

class UserController
{
    public function __invoke(int $id): array
    {
        return ['id' => $id, 'name' => 'Demo'];
    }
}
