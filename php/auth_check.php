<?php
// ─── Auth helper ─────────────────────────────────────────────────────────────
// Included by other PHP endpoints after $pdo is established.
// Call require_auth($pdo) at the top of any write route to enforce login.

function require_auth($pdo) {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer (.+)$/', $header, $m)) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required — please log in']);
        exit;
    }
    $token = trim($m[1]);
    $stmt  = $pdo->prepare("SELECT id, name, email FROM users WHERE api_token = ?");
    $stmt->execute([$token]);
    $user  = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session — please log in again']);
        exit;
    }
    return $user;
}
