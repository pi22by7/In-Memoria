<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\MarkdownHelper;
use App\Service\NotificationService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

final class DashboardController extends AbstractController
{
    public function __construct(
        private readonly MarkdownHelper $markdown,
        private readonly NotificationService $notifications,
    ) {
    }

    #[Route(path: '/dashboard', name: 'dashboard')]
    public function __invoke(): Response
    {
        $content = $this->markdown->render('# Welcome back!');
        $this->notifications->recordVisit($this->getUser());

        return new Response($content);
    }
}
