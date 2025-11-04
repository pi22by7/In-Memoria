<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Song;
use Illuminate\Contracts\Filesystem\Factory as Filesystem;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class StreamService
{
    public function __construct(
        private readonly Filesystem $filesystem,
        private readonly TokenValidator $validator,
    ) {
    }

    public function stream(Song $song, ?string $token): StreamedResponse
    {
        $this->validator->assertValid($song, $token);

        $path = $song->path;
        return new StreamedResponse(function () use ($path) {
            $stream = $this->filesystem->disk('songs')->readStream($path);
            fpassthru($stream);
        }, 200, [
            'Content-Type' => 'audio/mpeg',
        ]);
    }
}
