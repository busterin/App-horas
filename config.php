<?php
// config.php

// === DATOS DE LA BASE DE DATOS (NO TOCAR) ===
$DB_HOST = "db5019170058.hosting-data.io";
$DB_NAME = "dbs15054979";
$DB_USER = "dbu971505";
$DB_PASS = "Mayurni123!";

// === CONTRASEÑA DE ACCESO A LA APP ===
// Contraseña actual: Monoestratega8
$APP_PASS_HASH = '$2y$10$k6lV2kXnG8qZ9yCzJt3Y5u0N2xH3xv0E4Yc8h6QZz2mQv7kY6fX3C';

// === CONEXIÓN PDO ===
function get_pdo() {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;

    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    return new PDO($dsn, $DB_USER, $DB_PASS, $options);
}
