<?php
declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class Song extends Model
{
    protected $table = 'songs';
    protected $fillable = ['title', 'album_id', 'artist_id', 'length', 'path'];

    public function scopeRecentlyPlayed($query)
    {
        return $query->where('last_played_at', '>=', now()->subDays(7));
    }
}
