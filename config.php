<?php
// config.php
$DB_HOST = "db5019170058.hosting-data.io";
$DB_NAME = "dbs15054979";
$DB_USER = "dbu971505";
$DB_PASS = "Mayurni123!";

// ✅ Contraseña de acceso a la app (hash)
// Contraseña en claro: Monoestratega8
$APP_PASS_HASH = '$2y$12$e1s7P3i9HHr6z1pW958AXOCplrBX1kWVspdCMpG9u7rNpUd.00fjO';

function get_pdo() {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;

    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    return new PDO($dsn, $DB_USER, $DB_PASS, $options);
}
