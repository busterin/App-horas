<?php
// config.php
$DB_HOST = "tu_host_de_ionos";      // p.ej. db123456789.hosting-data.io
$DB_NAME = "nombre_de_la_bd";
$DB_USER = "usuario_de_la_bd";
$DB_PASS = "contraseña_de_la_bd";

function get_pdo() {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;

    $dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    return new PDO($dsn, $DB_USER, $DB_PASS, $options);
}
