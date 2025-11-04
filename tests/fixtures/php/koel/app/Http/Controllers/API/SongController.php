<?php
declare(strict_types=1);

namespace App\Http\Controllers\API;

use App\Models\Song;
use App\Services\StreamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SongController
{
    public function __construct(
        private readonly StreamService $stream,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $songs = Song::query()
            ->recentlyPlayed()
            ->limit((int) $request->get('limit', 20))
            ->get(['id', 'title', 'length']);

        return new JsonResponse($songs);
    }

    public function stream(int $song, Request $request)
    {
        $token = $request->query('token');
        return $this->stream->stream(Song::findOrFail($song), $token);
    }
}
