<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/config.php';

// ✅ Reutilizamos la misma config de BD
$dbHost = 'db5019170058.hosting-data.io';
$dbUser = 'dbu971505';
$dbPass = 'Mayurni123!';
$dbName = 'dbs15054979';

$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($mysqli->connect_error) {
    echo json_encode([
        "success" => false,
        "error" => "Error conexión BD: " . $mysqli->connect_error
    ]);
    exit;
}
$mysqli->set_charset("utf8mb4");

$action = isset($_GET["action"]) ? $_GET["action"] : "";

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function read_body_json() {
    $raw = file_get_contents("php://input");
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

switch ($action) {
    case "list_entries":
        list_entries($mysqli);
        break;

    case "add_entry":
        add_entry($mysqli);
        break;

    case "update_entry":
        update_entry($mysqli);
        break;

    case "delete_entry":
        delete_entry($mysqli);
        break;

    case "save_vehicles":
        save_vehicles($mysqli);
        break;

    default:
        echo json_encode([
            "success" => false,
            "error" => "Acción no válida"
        ]);
        break;
}

function list_entries($mysqli) {
    $sql = "SELECT id, date, vehicle, worker, hours, task
            FROM work_division_entries
            ORDER BY date DESC, id DESC";
    $res = $mysqli->query($sql);

    $rows = [];
    if ($res) {
        while ($r = $res->fetch_assoc()) {
            $rows[] = $r;
        }
    }

    echo json_encode([
        "success" => true,
        "entries" => $rows
    ]);
}

function add_entry($mysqli) {
    $data = read_body_json();

    $date = $data["date"] ?? "";
    $vehicle = $data["vehicle"] ?? "";
    $worker = $data["worker"] ?? "";
    $hours = $data["hours"] ?? 0;
    $task = $data["task"] ?? "";

    if ($date === "" || $vehicle === "" || $worker === "") {
        echo json_encode(["success" => false, "error" => "Campos obligatorios incompletos"]);
        return;
    }

    $stmt = $mysqli->prepare("INSERT INTO work_division_entries (date, vehicle, worker, hours, task) VALUES (?,?,?,?,?)");
    $stmt->bind_param("sssds", $date, $vehicle, $worker, $hours, $task);

    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => $ok]);
}

function update_entry($mysqli) {
    $data = read_body_json();

    $id = isset($data["id"]) ? intval($data["id"]) : 0;
    $date = $data["date"] ?? "";
    $vehicle = $data["vehicle"] ?? "";
    $worker = $data["worker"] ?? "";
    $hours = $data["hours"] ?? 0;
    $task = $data["task"] ?? "";

    if ($id <= 0) {
        echo json_encode(["success" => false, "error" => "ID inválido"]);
        return;
    }

    $stmt = $mysqli->prepare("UPDATE work_division_entries SET date=?, vehicle=?, worker=?, hours=?, task=? WHERE id=?");
    $stmt->bind_param("sssdsi", $date, $vehicle, $worker, $hours, $task, $id);

    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => $ok]);
}

function delete_entry($mysqli) {
    $data = read_body_json();
    $id = isset($data["id"]) ? intval($data["id"]) : 0;

    if ($id <= 0) {
        echo json_encode(["success" => false, "error" => "ID inválido"]);
        return;
    }

    $stmt = $mysqli->prepare("DELETE FROM work_division_entries WHERE id=?");
    $stmt->bind_param("i", $id);

    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => $ok]);
}

function save_vehicles($mysqli) {
    $data = read_body_json();
    $vehicles = isset($data["vehicles"]) && is_array($data["vehicles"]) ? $data["vehicles"] : [];

    $json = json_encode($vehicles, JSON_UNESCAPED_UNICODE);

    // Tabla work_division_config con una sola fila
    $mysqli->query("DELETE FROM work_division_config");

    $stmt = $mysqli->prepare("INSERT INTO work_division_config (vehicles_json) VALUES (?)");
    $stmt->bind_param("s", $json);

    $ok = $stmt->execute();
    $stmt->close();

    echo json_encode(["success" => $ok]);
}
