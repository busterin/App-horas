<?php
// api.php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *"); // si quieres, luego lo restringes
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $pdo = get_pdo();

    switch ($action) {
        case 'list_entries':
            list_entries($pdo);
            break;

        case 'save_all_entries':
            save_all_entries($pdo);
            break;

        default:
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "error"   => "Acción no válida"
            ]);
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error"   => $e->getMessage()
    ]);
}

/**
 * Devuelve todas las entradas de horas
 */
function list_entries(PDO $pdo) {
    $sql = "SELECT id, worker, company, project, week, hours, created_at
            FROM entries
            ORDER BY company, project, worker, week, id";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    echo json_encode([
        "success" => true,
        "entries" => $rows
    ]);
}

/**
 * Recibe todas las entradas en JSON y las guarda en la BD
 * Formato esperado:
 * {
 *   "entries": [
 *     {"id":123,"worker":"...","company":"...","project":"...","week":"2025-W01","hours":4},
 *     ...
 *   ]
 * }
 */
function save_all_entries(PDO $pdo) {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!is_array($data) || !isset($data["entries"]) || !is_array($data["entries"])) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error"   => "JSON inválido"
        ]);
        return;
    }

    $entries = $data["entries"];

    $pdo->beginTransaction();

    // Opcional: podrías hacer un diff, pero para simplificar borramos y volvemos a insertar
    $pdo->exec("TRUNCATE TABLE entries");

    $sql = "INSERT INTO entries (worker, company, project, week, hours, created_at)
            VALUES (:worker, :company, :project, :week, :hours, :created_at)";
    $stmt = $pdo->prepare($sql);

    foreach ($entries as $e) {
        $worker = isset($e["worker"]) ? $e["worker"] : "";
        $company = isset($e["company"]) ? $e["company"] : "";
        $project = isset($e["project"]) ? $e["project"] : "";
        $week = isset($e["week"]) ? $e["week"] : "";
        $hours = isset($e["hours"]) ? floatval($e["hours"]) : 0;
        $created_at = isset($e["created_at"]) ? $e["created_at"] : date('Y-m-d H:i:s');

        $stmt->execute([
            ":worker"     => $worker,
            ":company"    => $company,
            ":project"    => $project,
            ":week"       => $week,
            ":hours"      => $hours,
            ":created_at" => $created_at
        ]);
    }

    $pdo->commit();

    echo json_encode([
        "success" => true,
        "count"   => count($entries)
    ]);
}
