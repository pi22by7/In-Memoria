<?php
declare(strict_types=1);

namespace App\Service;

use League\CommonMark\CommonMarkConverter;

final class MarkdownHelper
{
    public function __construct(
        private readonly CommonMarkConverter $converter,
    ) {
    }

    public function render(string $markdown): string
    {
        return $this->converter->convert($markdown)->getContent();
    }
}
