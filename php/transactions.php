<?php
// ─── CORS ────────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ─── Database config ─────────────────────────────────────────────────────────
define('DB_HOST', '%%DB_HOST%%');
define('DB_NAME', '%%DB_NAME%%'); 
define('DB_USER', '%%DB_USER%%'); 
define('DB_PASS', '%%DB_PASS%%'); 

// ─── Connect ─────────────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// ─── Create table if needed ───────────────────────────────────────────────────
$pdo->exec("
    CREATE TABLE IF NOT EXISTS transactions (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        ticker     VARCHAR(20)   NOT NULL,
        date       DATE          NOT NULL,
        type       ENUM('buy','sell') NOT NULL,
        shares     DECIMAL(18,6) NOT NULL,
        price      DECIMAL(18,6) NOT NULL,
        fees       DECIMAL(18,6) NOT NULL DEFAULT 0,
        note       VARCHAR(500)  NOT NULL DEFAULT '',
        created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticker (ticker),
        INDEX idx_date   (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function castRow($r) {
    return [
        'id'     => (int)$r['id'],
        'ticker' => $r['ticker'],
        'date'   => $r['date'],
        'type'   => $r['type'],
        'shares' => (float)$r['shares'],
        'price'  => (float)$r['price'],
        'fees'   => (float)$r['fees'],
        'note'   => $r['note'],
    ];
}

// ─── Route ───────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
// Method override: PUT/DELETE tunnelled through POST (?_method=DELETE)
// Required for shared hosts (e.g. one.com) that block DELETE/PUT methods
if ($method === 'POST' && isset($_GET['_method'])) {
    $override = strtoupper(trim($_GET['_method']));
    if (in_array($override, ['PUT', 'DELETE'])) $method = $override;
}
$id     = isset($_GET['id'])     ? (int)$_GET['id']   : null;
$ticker = isset($_GET['ticker']) ? trim($_GET['ticker']) : null;
$batch  = isset($_GET['batch']);
$body   = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($method) {

    // ── GET /transactions.php            → all transactions
    // ── GET /transactions.php?ticker=X  → by ticker
    case 'GET':
        if ($ticker) {
            $stmt = $pdo->prepare("
                SELECT id, ticker, DATE_FORMAT(date,'%Y-%m-%d') AS date,
                       type, shares, price, fees, note
                FROM transactions WHERE ticker = ?
                ORDER BY date ASC, id ASC
            ");
            $stmt->execute([$ticker]);
        } else {
            $stmt = $pdo->query("
                SELECT id, ticker, DATE_FORMAT(date,'%Y-%m-%d') AS date,
                       type, shares, price, fees, note
                FROM transactions
                ORDER BY ticker, date ASC, id ASC
            ");
        }
        echo json_encode(array_map('castRow', $stmt->fetchAll(PDO::FETCH_ASSOC)));
        break;

    // ── POST /transactions.php            → single transaction
    // ── POST /transactions.php?batch=1   → array of transactions (seed/import)
    case 'POST':
        if ($batch) {
            // Bulk insert — used for one-time migration from hardcoded data
            if (!is_array($body) || count($body) === 0) {
                http_response_code(400); echo json_encode(['error' => 'Expected array']); exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO transactions (ticker, date, type, shares, price, fees, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $pdo->beginTransaction();
            $inserted = 0;
            foreach ($body as $t) {
                $stmt->execute([
                    trim($t['ticker'] ?? ''),
                    trim($t['date']   ?? ''),
                    trim($t['type']   ?? 'buy'),
                    (float)($t['shares'] ?? 0),
                    (float)($t['price']  ?? 0),
                    (float)($t['fees']   ?? 0),
                    trim($t['note']   ?? ''),
                ]);
                $inserted++;
            }
            $pdo->commit();
            echo json_encode(['inserted' => $inserted]);
        } else {
            // Single insert
            $t = trim($body['ticker'] ?? '');
            $d = trim($body['date']   ?? '');
            $y = trim($body['type']   ?? '');
            $s = (float)($body['shares'] ?? 0);
            $p = (float)($body['price']  ?? 0);
            $f = (float)($body['fees']   ?? 0);
            $n = trim($body['note']   ?? '');

            if (!$t || !$d || !$y || !$s || !$p) {
                http_response_code(400);
                echo json_encode(['error' => 'ticker, date, type, shares and price are required']);
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO transactions (ticker, date, type, shares, price, fees, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$t, $d, $y, $s, $p, $f, $n]);
            $newId = (int)$pdo->lastInsertId();
            http_response_code(201);
            echo json_encode(['id'=>$newId,'ticker'=>$t,'date'=>$d,'type'=>$y,'shares'=>$s,'price'=>$p,'fees'=>$f,'note'=>$n]);
        }
        break;

    // ── PUT /transactions.php?id=5  body: {date,type,shares,price,fees,note}
    case 'PUT':
        if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
        $d = trim($body['date']   ?? '');
        $y = trim($body['type']   ?? '');
        $s = (float)($body['shares'] ?? 0);
        $p = (float)($body['price']  ?? 0);
        $f = (float)($body['fees']   ?? 0);
        $n = trim($body['note']   ?? '');
        if (!$d || !$y || !$s || !$p) {
            http_response_code(400); echo json_encode(['error'=>'date, type, shares and price are required']); exit;
        }
        $stmt = $pdo->prepare("
            UPDATE transactions SET date=?, type=?, shares=?, price=?, fees=?, note=? WHERE id=?
        ");
        $stmt->execute([$d, $y, $s, $p, $f, $n, $id]);
        echo json_encode(['success' => true]);
        break;

    // ── DELETE /transactions.php?id=5
    case 'DELETE':
        if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
        $pdo->prepare("DELETE FROM transactions WHERE id=?")->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
