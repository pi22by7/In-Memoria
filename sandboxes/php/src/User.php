<?php
declare(strict_types=1);

namespace App\Model;

final class User
{
    public function __construct(
        private int $id,
        private string $email,
        private bool $active = true,
    ) {
    }

    public function id(): int
    {
        return $this->id;
    }

    public function email(): string
    {
        return $this->email;
    }

    public function activate(): void
    {
        $this->active = true;
    }

    public function deactivate(): void
    {
        $this->active = false;
    }

    public function isActive(): bool
    {
        return $this->active;
    }
}
