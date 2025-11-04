<?php
declare(strict_types=1);

namespace App\Repository;

use App\Model\User;

trait UserHydration
{
    /**
     * @param array{id:int,email:string,active?:bool} $row
     */
    private function hydrate(array $row): User
    {
        return new User(
            id: $row['id'],
            email: $row['email'],
            active: $row['active'] ?? true,
        );
    }
}
