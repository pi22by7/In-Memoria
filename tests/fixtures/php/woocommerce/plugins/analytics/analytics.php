<?php
/**
 * Plugin Name: WooCommerce Store Analytics
 */

declare(strict_types=1);

use WC\Admin\ProductSettings;

function wc_store_analytics_track(array $event): void
{
    error_log('Analytics event: ' . wp_json_encode($event));
}

function wc_store_analytics_boot(): void
{
    $settings = new ProductSettings();
    add_action('woocommerce_product_saved', static function ($productId) use ($settings) {
        $product = wc_get_product($productId);
        if (!$product instanceof WC_Product) {
            return;
        }

        $settings->updatePricing($product, [
            'price' => $product->get_price(),
        ]);
        wc_store_analytics_track(['product' => $productId, 'event' => 'saved']);
    });
}

wc_store_analytics_boot();
