<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Song;
use Illuminate\Auth\Access\AuthorizationException;

final class TokenValidator
{
    public function assertValid(Song $song, ?string $token): void
    {
        if ($token === null || !hash_equals($song->getAttribute('stream_token'), $token)) {
            throw new AuthorizationException('Invalid stream token.');
        }
    }
}
