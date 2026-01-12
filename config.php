<?php
// config.php

define('DB_HOST', 'db5019170058.hosting-data.io');
define('DB_NAME', 'dbs15054979');
define('DB_USER', 'dbu971505');
define('DB_PASS', 'Mayurni123!');

// Conexión PDO (para otras partes si se usa)
function get_pdo() {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

// ✅ HASH DE LOGIN (OBLIGATORIO COMO CONSTANTE)
define(
    'APP_PASS_HASH',
    '$2y$12$e1s7P3i9HHr6z1pW958AXOCplrBX1kWVspdCMpG9u7rNpUd.00fjO'
);
