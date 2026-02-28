<?php
// ─── Auth helper ─────────────────────────────────────────────────────────────
// Included by other PHP endpoints after $pdo is established.
// Call require_auth($pdo) at the top of any write route to enforce login.

// Apache on shared hosting (CGI/FastCGI) often strips HTTP_AUTHORIZATION from
// $_SERVER.  This helper tries every known fallback before giving up.
function get_auth_header() {
    // Standard path
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    // Some Apache rewrite setups prefix with REDIRECT_
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    // CGI/FastCGI fallback via getallheaders()
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strtolower($k) === 'authorization') return $v;
        }
    }
    return '';
}

function require_auth($pdo) {
    $header = get_auth_header();
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
