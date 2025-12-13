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
 *  HORAS (ENTRIES)
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

/**
 *  CONFIGURACIÓN DE PROYECTOS (projects, project_months, project_workers)
 *
 *  Estructura que espera/devuelve:
 *  projectsByCompany: {
 *     "Monognomo": {
 *        "2025-03": ["Proyecto A", "Proyecto B"],
 *        "2025-04": ["Proyecto C"]
 *     },
 *     "Neozink": {
 *        "2025-03": ["Proyecto X"]
 *     }
 *  }
 *
 *  projectWorkers: {
 *     "Monognomo": {
 *        "Proyecto A": ["Alba", "Buster"],
 *        "Proyecto B": ["Sara"]
 *     },
 *     "Neozink": {
 *        "Proyecto X": ["Castri"]
 *     }
 *  }
 */

function get_projects_config(PDO $pdo) {
    // Obtenemos proyectos + meses
    $sql = "SELECT p.id, p.company, p.name, pm.month_key
            FROM projects p
            LEFT JOIN project_months pm ON pm.project_id = p.id
            ORDER BY p.company, p.name, pm.month_key";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    $projectsByCompany = [];

    foreach ($rows as $row) {
        $company   = $row["company"];
        $name      = $row["name"];
        $month_key = $row["month_key"];

        if (!isset($projectsByCompany[$company])) {
            $projectsByCompany[$company] = [];
        }
        if ($month_key !== null) {
            if (!isset($projectsByCompany[$company][$month_key])) {
                $projectsByCompany[$company][$month_key] = [];
            }
            if (!in_array($name, $projectsByCompany[$company][$month_key], true)) {
                $projectsByCompany[$company][$month_key][] = $name;
            }
        }
    }

    // Obtenemos monognomos por proyecto
    $sql = "SELECT p.id, p.company, p.name, pw.worker
            FROM projects p
            LEFT JOIN project_workers pw ON pw.project_id = p.id
            ORDER BY p.company, p.name, pw.worker";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    $projectWorkers = [];

    foreach ($rows as $row) {
        $company = $row["company"];
        $name    = $row["name"];
        $worker  = $row["worker"];

        if (!isset($projectWorkers[$company])) {
            $projectWorkers[$company] = [];
        }
        if (!isset($projectWorkers[$company][$name])) {
            $projectWorkers[$company][$name] = [];
        }
        if ($worker !== null && $worker !== "" &&
            !in_array($worker, $projectWorkers[$company][$name], true)) {
            $projectWorkers[$company][$name][] = $worker;
        }
    }

    echo json_encode([
        "success"          => true,
        "projectsByCompany"=> $projectsByCompany,
        "projectWorkers"   => $projectWorkers
    ]);
}

function save_projects_config(PDO $pdo) {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (
        !is_array($data) ||
        !isset($data["projectsByCompany"]) ||
        !isset($data["projectWorkers"])
    ) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error"   => "JSON inválido"
        ]);
        return;
    }

    $projectsByCompany = $data["projectsByCompany"];
    $projectWorkers    = $data["projectWorkers"];

    if (!is_array($projectsByCompany) || !is_array($projectWorkers)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error"   => "Formato de configuración inválido"
        ]);
        return;
    }

    $pdo->beginTransaction();

    // Limpiamos tablas
    $pdo->exec("DELETE FROM project_workers");
    $pdo->exec("DELETE FROM project_months");
    $pdo->exec("DELETE FROM projects");

    // Mapa para reutilizar ids: [company][projectName] => project_id
    $projectIdMap = [];

    // 1) Insertar proyectos y meses
    $sqlInsertProject = "INSERT INTO projects (company, name)
                         VALUES (:company, :name)";
    $stmtProj = $pdo->prepare($sqlInsertProject);

    $sqlInsertMonth = "INSERT INTO project_months (project_id, month_key)
                       VALUES (:project_id, :month_key)";
    $stmtMonth = $pdo->prepare($sqlInsertMonth);

    foreach ($projectsByCompany as $company => $monthsMap) {
        if (!is_array($monthsMap)) continue;

        if (!isset($projectIdMap[$company])) {
            $projectIdMap[$company] = [];
        }

        foreach ($monthsMap as $monthKey => $projectsList) {
            if (!is_array($projectsList)) continue;

            foreach ($projectsList as $projectName) {
                if (!isset($projectIdMap[$company][$projectName])) {
                    // Nuevo proyecto
                    $stmtProj->execute([
                        ":company" => $company,
                        ":name"    => $projectName
                    ]);
                    $projectId = (int)$pdo->lastInsertId();
                    $projectIdMap[$company][$projectName] = $projectId;
                } else {
                    $projectId = $projectIdMap[$company][$projectName];
                }

                // Insertar mes si tiene formato correcto
                if (preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
                    $stmtMonth->execute([
                        ":project_id" => $projectId,
                        ":month_key"  => $monthKey
                    ]);
                }
            }
        }
    }

    // 2) Insertar monognomos por proyecto
    $sqlInsertWorker = "INSERT INTO project_workers (project_id, worker)
                        VALUES (:project_id, :worker)";
    $stmtWorker = $pdo->prepare($sqlInsertWorker);

    foreach ($projectWorkers as $company => $projectsMap) {
        if (!is_array($projectsMap)) continue;
        if (!isset($projectIdMap[$company])) continue;

        foreach ($projectsMap as $projectName => $workersList) {
            if (!is_array($workersList)) continue;
            if (!isset($projectIdMap[$company][$projectName])) {
                // Proyecto sin meses pero con trabajadores -> creamos entrada
                $stmtProj->execute([
                    ":company" => $company,
                    ":name"    => $projectName
                ]);
                $projectId = (int)$pdo->lastInsertId();
                $projectIdMap[$company][$projectName] = $projectId;
            } else {
                $projectId = $projectIdMap[$company][$projectName];
            }

            foreach ($workersList as $worker) {
                $worker = trim($worker);
                if ($worker === "") continue;

                $stmtWorker->execute([
                    ":project_id" => $projectId,
                    ":worker"     => $worker
                ]);
            }
        }
    }

    $pdo->commit();

    echo json_encode([
        "success" => true
    ]);
}
