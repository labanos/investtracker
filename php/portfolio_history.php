<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('DB_HOST', '%%DB_HOST%%');
define('DB_NAME', '%%DB_NAME%%');
define('DB_USER', '%%DB_USER%%');
define('DB_PASS', '%%DB_PASS%%');

try {
    $pdo = new PDO(
        'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}

require_once 'db_migrate.php';
run_migrations($pdo);

require_once 'auth_check.php';

// ── GET: return snapshot history for a portfolio ──────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pfId = (int)($_GET['id'] ?? 0);
    $ccy  = preg_replace('/[^A-Z]/', '', strtoupper($_GET['ccy'] ?? 'DKK'));

    if ($pfId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing id']);
        exit;
    }

    $stmt = $pdo->prepare(
        "SELECT snapshot_date AS date, total_value AS value
           FROM portfolio_snapshots
          WHERE portfolio_id = ? AND base_ccy = ?
          ORDER BY snapshot_date ASC"
    );
    $stmt->execute([$pfId, $ccy]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Cast value to float so JSON encodes as number
    $rows = array_map(fn($r) => ['date' => $r['date'], 'value' => (float)$r['value']], $rows);

    echo json_encode($rows);
    exit;
}

// ── POST: upsert today's snapshot (auth required) ────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = require_auth($pdo);

    $body  = json_decode(file_get_contents('php://input'), true) ?? [];
    $pfId  = (int)($body['portfolio_id'] ?? 0);
    $value = (float)($body['total_value'] ?? 0);
    $ccy   = preg_replace('/[^A-Z]/', '', strtoupper($body['base_ccy'] ?? 'DKK'));
    $date  = date('Y-m-d');

    if ($pfId <= 0 || $value <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid payload']);
        exit;
    }

    // Verify the portfolio belongs to this user
    $owns = (int)$pdo->prepare("SELECT COUNT(*) FROM portfolios WHERE id = ? AND user_id = ?")
        ->execute([$pfId, $user['id']]);
    // (execute returns bool, so re-query properly)
    $chk = $pdo->prepare("SELECT COUNT(*) FROM portfolios WHERE id = ? AND user_id = ?");
    $chk->execute([$pfId, $user['id']]);
    if ((int)$chk->fetchColumn() === 0) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    $pdo->prepare(
        "INSERT INTO portfolio_snapshots (portfolio_id, snapshot_date, total_value, base_ccy)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_value = VALUES(total_value)"
    )->execute([$pfId, $date, $value, $ccy]);

    echo json_encode(['ok' => true, 'date' => $date, 'value' => $value]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
