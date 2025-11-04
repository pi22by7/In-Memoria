<?php
declare(strict_types=1);

namespace Elementor\Modules\Forms;

final class FormModule
{
    public function registerWidgets(): void
    {
        // register custom widgets
    }

    public function renderSubmissionNotice(array $settings): string
    {
        $message = $settings['message'] ?? 'Thanks for contacting us.';
        return sprintf('<div class="e-form__success">%s</div>', esc_html($message));
    }
}
