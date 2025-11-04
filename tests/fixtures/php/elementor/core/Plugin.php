<?php
declare(strict_types=1);

namespace Elementor\Core;

use Elementor\Modules\Forms\FormModule;

final class Plugin
{
    private FormModule $forms;

    public function __construct(FormModule $forms)
    {
        $this->forms = $forms;
    }

    public function init(): void
    {
        add_action('init', [$this->forms, 'registerWidgets']);
    }
}
