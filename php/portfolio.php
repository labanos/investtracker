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

$pdo->exec("CREATE TABLE IF NOT EXISTS portfolio (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    ticker     VARCHAR(20)  NOT NULL UNIQUE,
    yh_ticker  VARCHAR(30)  NOT NULL,
    company    VARCHAR(100) NOT NULL,
    ccy        VARCHAR(10)  NOT NULL DEFAULT 'DKK',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
)");

require_once __DIR__ . '/db_migrate.php';
run_migrations($pdo);

// ─── Method override (DELETE/PUT tunnelled via POST) ─────────────────────
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $override = strtoupper(trim($_GET['_method']));
    if (in_array($override, ['PUT', 'DELETE'])) $method = $override;
}

// ─── GET — return all portfolio items for a portfolio ────────────────────
if ($method === 'GET') {
    $pfId = (int)($_GET['portfolio_id'] ?? 0);
    if (!$pfId) { http_response_code(400); echo json_encode(['error' => 'portfolio_id required']); exit; }
    $stmt = $pdo->prepare(
        "SELECT id, ticker, yh_ticker, company, ccy FROM portfolio WHERE portfolio_id = ? ORDER BY created_at ASC"
    );
    $stmt->execute([$pfId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// ─── POST ?batch=1 — bulk seed ────────────────────────────────────────────
if ($method === 'POST' && isset($_GET['batch'])) {
    $items = json_decode(file_get_contents('php://input'), true);
    if (!is_array($items)) { http_response_code(400); echo json_encode(['error' => 'Expected array']); exit; }
    $pfId = (int)($_GET['portfolio_id'] ?? ($items[0]['portfolio_id'] ?? 0));
    if (!$pfId) { http_response_code(400); echo json_encode(['error' => 'portfolio_id required']); exit; }
    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO portfolio (portfolio_id, ticker, yh_ticker, company, ccy) VALUES (?,?,?,?,?)"
    );
    foreach ($items as $item) {
        $yhTicker = $item['yhTicker'] ?? $item['yh_ticker'] ?? $item['ticker'];
        $stmt->execute([$pfId, $item['ticker'], $yhTicker, $item['company'], $item['ccy']]);
    }
    $all = $pdo->prepare(
        "SELECT id, ticker, yh_ticker, company, ccy FROM portfolio WHERE portfolio_id = ? ORDER BY created_at ASC"
    );
    $all->execute([$pfId]);
    $all = $all->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($all);
    exit;
}

// ─── POST — create single portfolio entry ─────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pfId     = (int)($data['portfolio_id'] ?? ($_GET['portfolio_id'] ?? 0));
    $ticker   = strtoupper(trim($data['ticker']   ?? ''));
    $yhTicker = trim($data['yhTicker'] ?? $data['yh_ticker'] ?? $ticker);
    $company  = trim($data['company']  ?? '');
    $ccy      = strtoupper(trim($data['ccy'] ?? 'USD'));
    if (!$pfId || !$ticker || !$company) {
        http_response_code(400); echo json_encode(['error' => 'portfolio_id, ticker and company are required']); exit;
    }
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO portfolio (portfolio_id, ticker, yh_ticker, company, ccy) VALUES (?,?,?,?,?)"
        );
        $stmt->execute([$pfId, $ticker, $yhTicker, $company, $ccy]);
        $id = (int)$pdo->lastInsertId();
        echo json_encode([
            'id' => $id, 'portfolio_id' => $pfId, 'ticker' => $ticker,
            'yh_ticker' => $yhTicker, 'company' => $company, 'ccy' => $ccy
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => "Ticker '$ticker' already exists in this portfolio"]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Could not create entry']);
        }
    }
    exit;
}

// ─── PUT — update yh_ticker / company / ccy ───────────────────────────────
if ($method === 'PUT') {
    $id   = (int)($_GET['id'] ?? 0);
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare(
        "UPDATE portfolio SET yh_ticker=?, company=?, ccy=? WHERE id=?"
    );
    $stmt->execute([
        trim($data['yhTicker'] ?? $data['yh_ticker'] ?? ''),
        trim($data['company']  ?? ''),
        strtoupper(trim($data['ccy'] ?? 'USD')),
        $id
    ]);
    echo json_encode(['ok' => true]);
    exit;
}

// ─── DELETE — remove portfolio entry ─────────────────────────────────────
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM portfolio WHERE id=?");
    $stmt->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
