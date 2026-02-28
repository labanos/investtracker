<?php
// ─── Schema migrations ───────────────────────────────────────────────────────
// Idempotent — safe to call on every request. Fast after first run.

function run_migrations($pdo) {

    // 1. portfolios table
    $pdo->exec("CREATE TABLE IF NOT EXISTS portfolios (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        user_id    INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Default portfolio — seed one if the table is empty
    $pfCount = (int)$pdo->query("SELECT COUNT(*) FROM portfolios")->fetchColumn();
    if ($pfCount === 0) {
        try {
            $uid = $pdo->query("SELECT id FROM users ORDER BY id LIMIT 1")->fetchColumn();
            if ($uid) {
                $pdo->prepare("INSERT INTO portfolios (name, user_id) VALUES ('My Portfolio', ?)")
                    ->execute([$uid]);
            }
        } catch (Exception $e) { /* users table may not exist yet on very first boot */ }
    }

    // Helpers
    $tableExists = function($table) use ($pdo) {
        return (int)$pdo->query(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$table'"
        )->fetchColumn() > 0;
    };
    $hasCol = function($table, $col) use ($pdo) {
        return (int)$pdo->query(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = '$table'
               AND COLUMN_NAME  = '$col'"
        )->fetchColumn() > 0;
    };

    $defaultPf = (int)($pdo->query("SELECT id FROM portfolios ORDER BY id LIMIT 1")->fetchColumn() ?: 1);

    // 3. portfolio (holdings) — add portfolio_id if table exists and column is missing
    if ($tableExists('portfolio') && !$hasCol('portfolio', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE portfolio ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf FIRST");
        try { $pdo->exec("ALTER TABLE portfolio DROP INDEX ticker"); }         catch (Exception $e) {}
        try { $pdo->exec("ALTER TABLE portfolio ADD UNIQUE KEY uniq_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }

    // 4. transactions — add portfolio_id if table exists and column is missing
    if ($tableExists('transactions') && !$hasCol('transactions', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE transactions ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf AFTER ticker");
        try { $pdo->exec("ALTER TABLE transactions ADD INDEX idx_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }

    // 5. notes — add portfolio_id if table exists and column is missing
    if ($tableExists('investment_notes') && !$hasCol('investment_notes', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE investment_notes ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf AFTER ticker");
        try { $pdo->exec("ALTER TABLE investment_notes ADD INDEX idx_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }

    // 6. portfolios — add base_currency if missing
    if (!$hasCol('portfolios', 'base_currency')) {
        $pdo->exec("ALTER TABLE portfolios ADD COLUMN base_currency VARCHAR(3) NOT NULL DEFAULT 'DKK' AFTER name");
    }

    // 7. portfolio (holdings) — add sector + country for insights
    if ($tableExists('portfolio') && !$hasCol('portfolio', 'sector')) {
        $pdo->exec("ALTER TABLE portfolio ADD COLUMN sector  VARCHAR(80) NULL AFTER ccy");
    }
    if ($tableExists('portfolio') && !$hasCol('portfolio', 'country')) {
        $pdo->exec("ALTER TABLE portfolio ADD COLUMN country VARCHAR(80) NULL AFTER sector");
    }
}
