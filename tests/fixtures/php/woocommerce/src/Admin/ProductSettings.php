<?php
declare(strict_types=1);

namespace WC\Admin;

use WC_Product;

final class ProductSettings
{
    /**
     * @param array<string,mixed> $options
     */
    public function updatePricing(WC_Product $product, array $options): void
    {
        if (isset($options['price'])) {
            $product->set_price((float) $options['price']);
        }

        if (isset($options['stock_quantity'])) {
            $product->stock_quantity = (int) $options['stock_quantity'];
        }
    }
}
