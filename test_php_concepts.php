<?php

namespace App\Services;

interface UserRepositoryInterface {
    public function findById(int $id): ?User;
    public function save(User $user): void;
}

class UserService implements UserRepositoryInterface {
    private UserRepositoryInterface $repository;
    
    public function __construct(UserRepositoryInterface $repository) {
        $this->repository = $repository;
    }
    
    public function findById(int $id): ?User {
        return $this->repository->findById($id);
    }
    
    public function save(User $user): void {
        $this->repository->save($user);
    }
    
    public static function createFactory(): self {
        return new self(new UserRepository());
    }
}

trait Loggable {
    public function log(string $message): void {
        error_log($message);
    }
}

class User {
    use Loggable;
    
    public function __construct(
        public int $id,
        public string $name,
        public ?string $email = null
    ) {}
}
