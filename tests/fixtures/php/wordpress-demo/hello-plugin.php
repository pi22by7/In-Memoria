<?php
/**
 * Plugin Name: Hello Demo
 */

function hello_demo_render(): string {
    return '<div>Hello Demo</div>';
}

add_shortcode('hello_demo', 'hello_demo_render');
