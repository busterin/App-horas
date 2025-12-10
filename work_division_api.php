<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// ⬇️ Cambia estos datos por los de tu base de datos (los mismos que en api.php)
$dbHost = 'db5019170058.hosting-data.io';
$dbUser = 'dbu971505';
$dbPass = 'Mayurni123!';
$dbName = 'dbs15054979';

$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($mysqli->connect_error) {
    echo json_encode([
        'success' => false,
        'error' => 'Error de conexión: ' . $mysqli->connect_error
    ]);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'list') {
    // Listar todos los eventos de división de trabajo
    $sql = "SELECT * FROM work_division ORDER BY event_date, event_name, id";
    $result = $mysqli->query($sql);

    if (!$result) {
        echo json_encode([
            'success' => false,
            'error' => 'Error en la consulta: ' . $mysqli->error
        ]);
        exit;
    }

    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = [
            'id' => (int)$row['id'],
            'eventName' => $row['event_name'],
            'place' => $row['place'],
            'eventDate' => $row['event_date'],
            'coordProject' => $row['coord_project'],
            'coordProd' => $row['coord_prod'],
            'teamSetup' => $row['team_setup']
                ? json_decode($row['team_setup'], true)
                : [],
            'setupDate' => $row['setup_date'],
            'setupVehicle' => $row['setup_vehicle'],
            'teamDismantle' => $row['team_dismantle']
                ? json_decode($row['team_dismantle'], true)
                : [],
            'dismantleDate' => $row['dismantle_date'],
            'dismantleVehicle' => $row['dismantle_vehicle'],
            'nights' => $row['nights']
        ];
    }

    echo json_encode([
        'success' => true,
        'items' => $items
    ]);
    exit;
}

if ($action === 'save_all') {
    // Guardar todo el listado (sobrescribe la tabla)
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) {
        echo json_encode([
            'success' => false,
            'error' => 'Formato de datos inválido'
        ]);
        exit;
    }

    $items = $data['items'];

    $mysqli->begin_transaction();

    try {
        // Vaciar tabla
        if (!$mysqli->query("DELETE FROM work_division")) {
            throw new Exception('Error al borrar datos existentes: ' . $mysqli->error);
        }

        // Preparar insert
        $stmt = $mysqli->prepare("
            INSERT INTO work_division (
                event_name,
                place,
                event_date,
                coord_project,
                coord_prod,
                team_setup,
                setup_date,
                setup_vehicle,
                team_dismantle,
                dismantle_date,
                dismantle_vehicle,
                nights
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ");

        if (!$stmt) {
            throw new Exception('Error en prepare: ' . $mysqli->error);
        }

        foreach ($items as $item) {
            $eventName = isset($item['eventName']) ? $item['eventName'] : '';
            $place = isset($item['place']) ? $item['place'] : null;
            $eventDate = isset($item['eventDate']) ? $item['eventDate'] : null;
            $coordProject = isset($item['coordProject']) ? $item['coordProject'] : null;
            $coordProd = isset($item['coordProd']) ? $item['coordProd'] : null;

            $teamSetupArr = isset($item['teamSetup']) && is_array($item['teamSetup'])
                ? $item['teamSetup'] : [];
            $teamSetupJson = json_encode($teamSetupArr);

            $setupDate = isset($item['setupDate']) ? $item['setupDate'] : null;
            $setupVehicle = isset($item['setupVehicle']) ? $item['setupVehicle'] : null;

            $teamDismantleArr = isset($item['teamDismantle']) && is_array($item['teamDismantle'])
                ? $item['teamDismantle'] : [];
            $teamDismantleJson = json_encode($teamDismantleArr);

            $dismantleDate = isset($item['dismantleDate']) ? $item['dismantleDate'] : null;
            $dismantleVehicle = isset($item['dismantleVehicle']) ? $item['dismantleVehicle'] : null;

            $nights = isset($item['nights']) ? $item['nights'] : null;

            $stmt->bind_param(
                "ssssssssssss",
                $eventName,
                $place,
                $eventDate,
                $coordProject,
                $coordProd,
                $teamSetupJson,
                $setupDate,
                $setupVehicle,
                $teamDismantleJson,
                $dismantleDate,
                $dismantleVehicle,
                $nights
            );

            if (!$stmt->execute()) {
                throw new Exception('Error al insertar: ' . $stmt->error);
            }
        }

        $stmt->close();
        $mysqli->commit();

        echo json_encode([
            'success' => true
        ]);
        exit;

    } catch (Exception $e) {
        $mysqli->rollback();
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
        exit;
    }
}

// Acción desconocida
echo json_encode([
    'success' => false,
    'error' => 'Acción no reconocida'
]);
