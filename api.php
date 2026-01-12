<?php
// =======================================
// api.php — FINAL DEFINITIVO
// Login blindado (constante o variable)
// =======================================

ini_set('display_errors', 0);
error_reporting(0);
header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? "";

// =======================================
// LOGIN (NO USA BD, NO SE ROMPE)
// Acepta APP_PASS_HASH como:
//  - define('APP_PASS_HASH', '...')
//  - $APP_PASS_HASH = '...'
// =======================================
if ($action === "login") {
    $data = json_decode(file_get_contents("php://input"), true);
    $password = $data["password"] ?? "";

    $hash = null;

    // 1️⃣ Preferimos CONSTANTE
    if (defined("APP_PASS_HASH") && APP_PASS_HASH) {
        $hash = APP_PASS_HASH;
    }
    // 2️⃣ Fallback a VARIABLE antigua
    elseif (isset($GLOBALS["APP_PASS_HASH"]) && $GLOBALS["APP_PASS_HASH"]) {
        $hash = $GLOBALS["APP_PASS_HASH"];
    }

    if (!$hash) {
        echo json_encode([
            "success" => false,
            "error" => "APP_PASS_HASH_NOT_SET"
        ]);
        exit;
    }

    echo json_encode([
        "success" => password_verify($password, $hash)
    ]);
    exit;
}

// =======================================
// CONEXIÓN BD (solo para lo demás)
// =======================================
try {
    $pdo = get_pdo();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "DB_CONNECTION_FAILED"
    ]);
    exit;
}

// =======================================
// ROUTER
// =======================================
switch ($action) {

    case "list_entries":
        list_entries($pdo);
        break;

    case "save_all_entries":
        save_all_entries($pdo);
        break;

    case "save_projects_config":
        save_projects_config($pdo);
        break;

    case "get_projects_config":
        get_projects_config($pdo);
        break;

    case "delete_project":
        delete_project($pdo);
        break;

    default:
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "UNKNOWN_ACTION"
        ]);
}

// =======================================
// FUNCIONES
// =======================================

function list_entries(PDO $pdo) {
    $rows = $pdo->query(
        "SELECT id, worker, company, project, week, hours
         FROM entries
         ORDER BY id ASC"
    )->fetchAll();

    echo json_encode([
        "success" => true,
        "entries" => $rows
    ]);
}

// ---------------------------------------
function save_all_entries(PDO $pdo) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data["entries"])) {
        http_response_code(400);
        echo json_encode(["success" => false]);
        return;
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec("DELETE FROM entries");

        $stmt = $pdo->prepare(
            "INSERT INTO entries
             (id, worker, company, project, week, hours, created_at)
             VALUES
             (:id,:worker,:company,:project,:week,:hours,NOW())"
        );

        foreach ($data["entries"] as $e) {
            if (!isset($e["id"])) continue;

            $stmt->execute([
                ":id"      => $e["id"],
                ":worker"  => $e["worker"]  ?? "",
                ":company" => $e["company"] ?? "",
                ":project" => $e["project"] ?? "",
                ":week"    => $e["week"]    ?? "",
                ":hours"   => $e["hours"]   ?? 0
            ]);
        }

        $pdo->commit();
        echo json_encode(["success" => true]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "SAVE_FAILED"]);
    }
}

// =======================================
// PROYECTOS (leer desde BD real)
// =======================================

function save_projects_config(PDO $pdo) {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "INVALID_JSON"]);
        return;
    }

    $projectsByCompany = $data["projectsByCompany"] ?? null;
    $projectWorkers    = $data["projectWorkers"] ?? [];

    if (!is_array($projectsByCompany)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "projectsByCompany missing"]);
        return;
    }
    if (!is_array($projectWorkers)) {
        $projectWorkers = [];
    }

    // 1) Recolectar conjunto de proyectos (company + name)
    $projectSet = [];
    foreach ($projectsByCompany as $company => $monthsMap) {
        if (!is_array($monthsMap)) continue;
        foreach ($monthsMap as $monthKey => $list) {
            if (!is_array($list)) continue;
            foreach ($list as $projectName) {
                $c = trim((string)$company);
                $p = trim((string)$projectName);
                if ($c === "" || $p === "") continue;
                $projectSet[$c . "||" . $p] = [$c, $p];
            }
        }
    }
    foreach ($projectWorkers as $company => $projectsMap) {
        if (!is_array($projectsMap)) continue;
        foreach ($projectsMap as $projectName => $workers) {
            $c = trim((string)$company);
            $p = trim((string)$projectName);
            if ($c === "" || $p === "") continue;
            $projectSet[$c . "||" . $p] = [$c, $p];
        }
    }

    try {
        $pdo->beginTransaction();

        // 2) Asegurar proyectos en tabla projects y construir ids
        $getId = $pdo->prepare("SELECT id FROM projects WHERE company = ? AND name = ? LIMIT 1");
        $ins   = $pdo->prepare("INSERT INTO projects (company, name) VALUES (?, ?)");
        $idByKey = [];

        foreach ($projectSet as $key => $pair) {
            [$c, $p] = $pair;
            $getId->execute([$c, $p]);
            $pid = $getId->fetchColumn();
            if (!$pid) {
                $ins->execute([$c, $p]);
                $pid = $pdo->lastInsertId();
            }
            $idByKey[$key] = (int)$pid;
        }

        // 3) Reescribir relaciones (solo tablas de relación)
        $pdo->exec("DELETE FROM project_months");
        $pdo->exec("DELETE FROM project_workers");

        $insMonth = $pdo->prepare("INSERT INTO project_months (project_id, month_key) VALUES (?, ?)");
        foreach ($projectsByCompany as $company => $monthsMap) {
            if (!is_array($monthsMap)) continue;
            foreach ($monthsMap as $monthKey => $list) {
                if (!is_array($list)) continue;
                $mk = trim((string)$monthKey);
                if ($mk === "") continue;
                foreach ($list as $projectName) {
                    $c = trim((string)$company);
                    $p = trim((string)$projectName);
                    if ($c === "" || $p === "") continue;
                    $key = $c . "||" . $p;
                    if (!isset($idByKey[$key])) continue;
                    $insMonth->execute([$idByKey[$key], $mk]);
                }
            }
        }

        $insWorker = $pdo->prepare("INSERT INTO project_workers (project_id, worker) VALUES (?, ?)");
        foreach ($projectWorkers as $company => $projectsMap) {
            if (!is_array($projectsMap)) continue;
            foreach ($projectsMap as $projectName => $workers) {
                if (!is_array($workers)) continue;
                $c = trim((string)$company);
                $p = trim((string)$projectName);
                if ($c === "" || $p === "") continue;
                $key = $c . "||" . $p;
                if (!isset($idByKey[$key])) continue;
                foreach ($workers as $w) {
                    $worker = trim((string)$w);
                    if ($worker === "") continue;
                    $insWorker->execute([$idByKey[$key], $worker]);
                }
            }
        }

        $pdo->commit();
        echo json_encode(["success" => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "SAVE_PROJECTS_FAILED"]);
    }
}


function get_projects_config(PDO $pdo) {

    // --- PROYECTOS POR EMPRESA Y MES ---
    $projectsByCompany = [];

    $sql = "
        SELECT
            p.company,
            p.name AS project,
            pm.month_key
        FROM projects p
        JOIN project_months pm ON pm.project_id = p.id
        ORDER BY p.company, pm.month_key, p.name
    ";

    foreach ($pdo->query($sql) as $row) {
        $c = $row["company"];
        $m = $row["month_key"];
        $p = $row["project"];

        if (!isset($projectsByCompany[$c])) {
            $projectsByCompany[$c] = [];
        }
        if (!isset($projectsByCompany[$c][$m])) {
            $projectsByCompany[$c][$m] = [];
        }
        if (!in_array($p, $projectsByCompany[$c][$m], true)) {
            $projectsByCompany[$c][$m][] = $p;
        }
    }

    // --- TRABAJADORES POR PROYECTO ---
    $projectWorkers = [];

    $sql = "
        SELECT
            p.company,
            p.name AS project,
            pw.worker
        FROM project_workers pw
        JOIN projects p ON p.id = pw.project_id
        ORDER BY p.company, p.name
    ";

    foreach ($pdo->query($sql) as $row) {
        $c = $row["company"];
        $p = $row["project"];
        $w = $row["worker"];

        if (!isset($projectWorkers[$c])) {
            $projectWorkers[$c] = [];
        }
        if (!isset($projectWorkers[$c][$p])) {
            $projectWorkers[$c][$p] = [];
        }
        if (!in_array($w, $projectWorkers[$c][$p], true)) {
            $projectWorkers[$c][$p][] = $w;
        }
    }

    echo json_encode([
        "success" => true,
        "projectsByCompany" => $projectsByCompany,
        "projectWorkers"    => $projectWorkers
    ]);
}

// =======================================
// BORRAR PROYECTO (persistente)
// =======================================
function delete_project(PDO $pdo) {
    $data = json_decode(file_get_contents("php://input"), true);

    $company = trim((string)($data["company"] ?? ""));
    $project = trim((string)($data["project"] ?? ""));

    if ($company === "" || $project === "") {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "MISSING_FIELDS"]);
        return;
    }

    try {
        // Buscar ID
        $stmt = $pdo->prepare(
            "SELECT id FROM projects WHERE company = :c AND name = :p LIMIT 1"
        );
        $stmt->execute([":c" => $company, ":p" => $project]);
        $row = $stmt->fetch();

        if (!$row) {
            echo json_encode(["success" => false, "error" => "PROJECT_NOT_FOUND"]);
            return;
        }

        $pid = (int)$row["id"];

        $pdo->beginTransaction();

        // Relaciones
        $stmt = $pdo->prepare("DELETE FROM project_months WHERE project_id = :pid");
        $stmt->execute([":pid" => $pid]);

        $stmt = $pdo->prepare("DELETE FROM project_workers WHERE project_id = :pid");
        $stmt->execute([":pid" => $pid]);

        // Proyecto
        $stmt = $pdo->prepare("DELETE FROM projects WHERE id = :pid");
        $stmt->execute([":pid" => $pid]);

        // Horas asociadas (limpieza)
        $stmt = $pdo->prepare(
            "DELETE FROM entries WHERE company = :c AND project = :p"
        );
        $stmt->execute([":c" => $company, ":p" => $project]);

        $pdo->commit();
        echo json_encode(["success" => true]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "DELETE_FAILED"]);
    }
}
