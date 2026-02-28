<?php
// ─── Schema migrations ───────────────────────────────────────────────────────
// Idempotent — safe to call on every request. Fast after first run.

function run_migrations($pdo) {

    // 1. portfolios table (the "containers" that hold a set of holdings)
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

    // Helper: check if a column exists in a table
    $hasCol = function($table, $col) use ($pdo) {
        return (int)$pdo->query(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = '$table'
               AND COLUMN_NAME  = '$col'"
        )->fetchColumn() > 0;
    };

    $defaultPf = (int)($pdo->query("SELECT id FROM portfolios ORDER BY id LIMIT 1")->fetchColumn() ?: 1);

    // 3. portfolio (holdings) — add portfolio_id
    if (!$hasCol('portfolio', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE portfolio ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf FIRST");
        try { $pdo->exec("ALTER TABLE portfolio DROP INDEX ticker"); }         catch (Exception $e) {}
        try { $pdo->exec("ALTER TABLE portfolio ADD UNIQUE KEY uniq_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }

    // 4. transactions — add portfolio_id
    if (!$hasCol('transactions', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE transactions ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf AFTER ticker");
        try { $pdo->exec("ALTER TABLE transactions ADD INDEX idx_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }

    // 5. notes — add portfolio_id
    if (!$hasCol('notes', 'portfolio_id')) {
        $pdo->exec("ALTER TABLE notes ADD COLUMN portfolio_id INT NOT NULL DEFAULT $defaultPf AFTER ticker");
        try { $pdo->exec("ALTER TABLE notes ADD INDEX idx_pf_ticker (portfolio_id, ticker)"); }
        catch (Exception $e) {}
    }
}
