<?php
// api.php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
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

        case 'get_projects_config':
            get_projects_config($pdo);
            break;

        case 'save_projects_config':
            save_projects_config($pdo);
            break;

        case 'login':
            login_action();
            break;

        default:
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "error"   => "Acción no válida"
            ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error"   => $e->getMessage()
    ]);
}

function read_json_body() {
    $raw = file_get_contents("php://input");
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function list_entries(PDO $pdo) {
    $stmt = $pdo->query("SELECT id, week, company, project, worker, hours, description FROM entries ORDER BY id DESC");
    $rows = $stmt->fetchAll();

    echo json_encode([
        "success" => true,
        "entries" => $rows
    ]);
}

function save_all_entries(PDO $pdo) {
    $data = read_json_body();
    $entries = isset($data["entries"]) && is_array($data["entries"]) ? $data["entries"] : [];

    // Reemplazo completo para evitar duplicados
    $pdo->beginTransaction();
    $pdo->exec("TRUNCATE TABLE entries");

    $sql = "INSERT INTO entries (week, company, project, worker, hours, description)
            VALUES (:week, :company, :project, :worker, :hours, :description)";
    $stmt = $pdo->prepare($sql);

    foreach ($entries as $e) {
        $week = isset($e["week"]) ? $e["week"] : "";
        $company = isset($e["company"]) ? $e["company"] : "";
        $project = isset($e["project"]) ? $e["project"] : "";
        $worker = isset($e["worker"]) ? $e["worker"] : "";
        $hours = isset($e["hours"]) ? $e["hours"] : 0;
        $desc = isset($e["desc"]) ? $e["desc"] : (isset($e["description"]) ? $e["description"] : "");

        if ($week === "" || $company === "" || $project === "" || $worker === "") continue;

        $stmt->execute([
            ":week" => $week,
            ":company" => $company,
            ":project" => $project,
            ":worker" => $worker,
            ":hours" => $hours,
            ":description" => $desc
        ]);
    }

    $pdo->commit();

    echo json_encode([
        "success" => true
    ]);
}

function get_projects_config(PDO $pdo) {
    // Tabla projects_config: id, projects_by_company_json, project_workers_json
    $stmt = $pdo->query("SELECT projects_by_company_json, project_workers_json FROM projects_config LIMIT 1");
    $row = $stmt->fetch();

    $projectsByCompany = [];
    $projectWorkers = [];

    if ($row) {
        $projectsByCompany = json_decode($row["projects_by_company_json"], true);
        $projectWorkers = json_decode($row["project_workers_json"], true);

        if (!is_array($projectsByCompany)) $projectsByCompany = [];
        if (!is_array($projectWorkers)) $projectWorkers = [];
    }

    echo json_encode([
        "success" => true,
        "projects_by_company" => $projectsByCompany,
        "project_workers" => $projectWorkers
    ]);
}

function save_projects_config(PDO $pdo) {
    $data = read_json_body();

    $projectsByCompany = isset($data["projects_by_company"]) ? $data["projects_by_company"] : [];
    $projectWorkers = isset($data["project_workers"]) ? $data["project_workers"] : [];

    $projectsJson = json_encode($projectsByCompany, JSON_UNESCAPED_UNICODE);
    $workersJson  = json_encode($projectWorkers, JSON_UNESCAPED_UNICODE);

    // Upsert simple con una sola fila
    $pdo->beginTransaction();

    $pdo->exec("DELETE FROM projects_config");

    $stmt = $pdo->prepare("INSERT INTO projects_config (projects_by_company_json, project_workers_json)
                           VALUES (:pjson, :wjson)");
    $stmt->execute([
        ":pjson" => $projectsJson,
        ":wjson" => $workersJson
    ]);

    $pdo->commit();

    echo json_encode([
        "success" => true
    ]);
}

// ---- LOGIN (solo valida la contraseña; NO crea sesión) ----
function login_action() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $password = isset($data['password']) ? (string)$data['password'] : '';

    // Hash en config.php
    global $APP_PASS_HASH;

    $ok = false;
    if (!empty($APP_PASS_HASH) && $password !== '') {
        $ok = password_verify($password, $APP_PASS_HASH);
    }

    echo json_encode([
        'success' => (bool)$ok
    ]);
}
