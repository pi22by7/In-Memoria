<?php
declare(strict_types=1);

namespace App\Repository;

use App\Model\User;

final class UserRepository
{
    use UserHydration;

    /**
     * @var array<int, array{id:int,email:string,active?:bool}>
     */
    private array $records = [];

    public function __construct()
    {
        $this->records = [
            1 => ['id' => 1, 'email' => 'demo@example.com', 'active' => true],
            2 => ['id' => 2, 'email' => 'archived@example.com', 'active' => false],
        ];
    }

    public function find(int $id): ?User
    {
        $record = $this->records[$id] ?? null;
        if ($record === null) {
            return null;
        }

        return $this->hydrate($record);
    }
}
