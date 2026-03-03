<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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

require_once __DIR__ . '/auth_check.php';

// ── Schema bootstrap (idempotent) ─────────────────────────────────────────────

$pdo->exec("CREATE TABLE IF NOT EXISTS valuation_models (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id INT NOT NULL,
    ticker       VARCHAR(20) NOT NULL,
    model_date   DATE NOT NULL,
    currency     VARCHAR(10) NOT NULL DEFAULT 'USD',
    notes        TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_pf_ticker_date (portfolio_id, ticker, model_date),
    INDEX idx_pf_ticker (portfolio_id, ticker)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS valuation_actuals (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    model_id     INT NOT NULL,
    label        ENUM('Y-2','Y-1','Y0') NOT NULL,
    fiscal_year  SMALLINT NOT NULL,
    revenue      DECIMAL(18,2),
    gross_profit DECIMAL(18,2),
    op_income    DECIMAL(18,2),
    net_income   DECIMAL(18,2),
    shares       DECIMAL(12,2),
    UNIQUE KEY uniq_model_label (model_id, label),
    INDEX idx_model (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS valuation_scenarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    model_id        INT NOT NULL,
    scenario        ENUM('bear','base','bull') NOT NULL,
    scenario_weight DECIMAL(5,4) NOT NULL DEFAULT 0.3333,
    current_price   DECIMAL(12,4),
    rev_growth      DECIMAL(8,4),
    tgt_gm          DECIMAL(8,4),
    tgt_om          DECIMAL(8,4),
    op_conv         DECIMAL(8,4),
    shr_chg         DECIMAL(8,4),
    proj_years      TINYINT NOT NULL DEFAULT 5,
    disc_rt         DECIMAL(8,4),
    mos             DECIMAL(8,4),
    multiples       JSON,
    UNIQUE KEY uniq_model_scenario (model_id, scenario),
    INDEX idx_model (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS valuation_history (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    model_id     INT NOT NULL,
    fiscal_year  SMALLINT NOT NULL,
    revenue      DECIMAL(18,2),
    gross_profit DECIMAL(18,2),
    op_income    DECIMAL(18,2),
    net_income   DECIMAL(18,2),
    shares       DECIMAL(12,2),
    UNIQUE KEY uniq_model_year (model_id, fiscal_year),
    INDEX idx_model (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ── Method override ───────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $override = strtoupper(trim($_GET['_method']));
    if ($override === 'DELETE') $method = 'DELETE';
}

// ── GET — fetch latest model for a ticker ─────────────────────────────────────
if ($method === 'GET') {
    $ticker    = strtoupper(trim($_GET['ticker']    ?? ''));
    $pfId      = (int)($_GET['portfolio_id'] ?? 0);
    if (!$ticker || !$pfId) {
        http_response_code(400);
        echo json_encode(['error' => 'ticker and portfolio_id required']);
        exit;
    }

    // Most recent model for this ticker in this portfolio
    $stmt = $pdo->prepare(
        "SELECT * FROM valuation_models
         WHERE portfolio_id = ? AND ticker = ?
         ORDER BY model_date DESC LIMIT 1"
    );
    $stmt->execute([$pfId, $ticker]);
    $model = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$model) {
        echo json_encode(null);
        exit;
    }

    $mid = (int)$model['id'];

    $stmt = $pdo->prepare(
        "SELECT * FROM valuation_actuals WHERE model_id = ? ORDER BY FIELD(label,'Y-2','Y-1','Y0')"
    );
    $stmt->execute([$mid]);
    $model['actuals'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare(
        "SELECT * FROM valuation_scenarios WHERE model_id = ? ORDER BY FIELD(scenario,'bear','base','bull')"
    );
    $stmt->execute([$mid]);
    $scenarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Decode multiples JSON for each scenario
    foreach ($scenarios as &$sc) {
        if (isset($sc['multiples']) && is_string($sc['multiples'])) {
            $sc['multiples'] = json_decode($sc['multiples'], true);
        }
    }
    $model['scenarios'] = $scenarios;

    $stmt = $pdo->prepare(
        "SELECT * FROM valuation_history WHERE model_id = ? ORDER BY fiscal_year ASC"
    );
    $stmt->execute([$mid]);
    $model['history'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($model);
    exit;
}

// ── POST — upsert full model (model + actuals + scenarios + history) ───────────
if ($method === 'POST') {
    require_auth($pdo);

    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit; }

    $pfId      = (int)($data['portfolio_id'] ?? 0);
    $ticker    = strtoupper(trim($data['ticker'] ?? ''));
    $modelDate = trim($data['model_date'] ?? date('Y-m-d'));
    $currency  = strtoupper(trim($data['currency'] ?? 'USD'));
    $notes     = trim($data['notes'] ?? '');

    if (!$pfId || !$ticker) {
        http_response_code(400);
        echo json_encode(['error' => 'portfolio_id and ticker required']);
        exit;
    }

    $pdo->beginTransaction();
    try {
        // Upsert model record (replace on unique key)
        $stmt = $pdo->prepare(
            "INSERT INTO valuation_models (portfolio_id, ticker, model_date, currency, notes)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE currency=VALUES(currency), notes=VALUES(notes), updated_at=NOW()"
        );
        $stmt->execute([$pfId, $ticker, $modelDate, $currency, $notes]);

        // Fetch the model id (newly inserted or existing)
        $stmt = $pdo->prepare(
            "SELECT id FROM valuation_models WHERE portfolio_id=? AND ticker=? AND model_date=?"
        );
        $stmt->execute([$pfId, $ticker, $modelDate]);
        $mid = (int)$stmt->fetchColumn();

        // Replace actuals
        $pdo->prepare("DELETE FROM valuation_actuals WHERE model_id=?")->execute([$mid]);
        $stmtAct = $pdo->prepare(
            "INSERT INTO valuation_actuals (model_id, label, fiscal_year, revenue, gross_profit, op_income, net_income, shares)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        foreach (($data['actuals'] ?? []) as $act) {
            $stmtAct->execute([
                $mid,
                $act['label'],
                (int)$act['fiscal_year'],
                isset($act['revenue'])      ? (float)$act['revenue']      : null,
                isset($act['gross_profit']) ? (float)$act['gross_profit'] : null,
                isset($act['op_income'])    ? (float)$act['op_income']    : null,
                isset($act['net_income'])   ? (float)$act['net_income']   : null,
                isset($act['shares'])       ? (float)$act['shares']       : null,
            ]);
        }

        // Replace scenarios
        $pdo->prepare("DELETE FROM valuation_scenarios WHERE model_id=?")->execute([$mid]);
        $stmtSc = $pdo->prepare(
            "INSERT INTO valuation_scenarios
             (model_id, scenario, scenario_weight, current_price, rev_growth, tgt_gm, tgt_om,
              op_conv, shr_chg, proj_years, disc_rt, mos, multiples)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        foreach (($data['scenarios'] ?? []) as $sc) {
            $stmtSc->execute([
                $mid,
                $sc['scenario'],
                (float)($sc['scenario_weight'] ?? 0.3333),
                isset($sc['current_price']) ? (float)$sc['current_price'] : null,
                isset($sc['rev_growth'])    ? (float)$sc['rev_growth']    : null,
                isset($sc['tgt_gm'])        ? (float)$sc['tgt_gm']       : null,
                isset($sc['tgt_om'])        ? (float)$sc['tgt_om']       : null,
                isset($sc['op_conv'])       ? (float)$sc['op_conv']      : null,
                isset($sc['shr_chg'])       ? (float)$sc['shr_chg']      : null,
                (int)($sc['proj_years']     ?? 5),
                isset($sc['disc_rt'])       ? (float)$sc['disc_rt']      : null,
                isset($sc['mos'])           ? (float)$sc['mos']          : null,
                json_encode($sc['multiples'] ?? []),
            ]);
        }

        // Replace history
        $pdo->prepare("DELETE FROM valuation_history WHERE model_id=?")->execute([$mid]);
        $stmtHist = $pdo->prepare(
            "INSERT INTO valuation_history (model_id, fiscal_year, revenue, gross_profit, op_income, net_income, shares)
             VALUES (?,?,?,?,?,?,?)"
        );
        foreach (($data['history'] ?? []) as $h) {
            $stmtHist->execute([
                $mid,
                (int)$h['fiscal_year'],
                isset($h['revenue'])      ? (float)$h['revenue']      : null,
                isset($h['gross_profit']) ? (float)$h['gross_profit'] : null,
                isset($h['op_income'])    ? (float)$h['op_income']    : null,
                isset($h['net_income'])   ? (float)$h['net_income']   : null,
                isset($h['shares'])       ? (float)$h['shares']       : null,
            ]);
        }

        $pdo->commit();
        echo json_encode(['ok' => true, 'model_id' => $mid]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Could not save valuation: ' . $e->getMessage()]);
    }
    exit;
}

// ── DELETE — remove model and all child records ───────────────────────────────
if ($method === 'DELETE') {
    require_auth($pdo);

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'id required']); exit; }

    $pdo->prepare("DELETE FROM valuation_actuals   WHERE model_id=?")->execute([$id]);
    $pdo->prepare("DELETE FROM valuation_scenarios WHERE model_id=?")->execute([$id]);
    $pdo->prepare("DELETE FROM valuation_history   WHERE model_id=?")->execute([$id]);
    $pdo->prepare("DELETE FROM valuation_models    WHERE id=?")->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

