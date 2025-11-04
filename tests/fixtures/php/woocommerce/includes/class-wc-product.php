<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

final class WC_Product
{
    protected array $data = [
        'name' => '',
        'price' => 0.0,
        'stock_quantity' => 0,
    ];

    public function set_name(string $name): void
    {
        $this->data['name'] = $name;
    }

    public function set_price(float $price): void
    {
        $this->data['price'] = $price;
    }

    public function get_price(): float
    {
        return $this->data['price'];
    }
}
