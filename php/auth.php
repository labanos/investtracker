<?php
// ─── CORS ────────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
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
    http_response_code(500); echo json_encode(['error' => 'Database connection failed']); exit;
}

// ─── Create table if needed ───────────────────────────────────────────────────
$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(100)  NOT NULL,
        email         VARCHAR(200)  NOT NULL UNIQUE,
        password_hash VARCHAR(255)  NOT NULL,
        api_token     VARCHAR(64)   DEFAULT NULL,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_token (api_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ─── Method override ─────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $override = strtoupper(trim($_GET['_method']));
    if ($override === 'DELETE') $method = 'DELETE';
}
$body = json_decode(file_get_contents('php://input'), true) ?: [];

// Apache CGI/FastCGI often strips HTTP_AUTHORIZATION — try all fallbacks
function get_auth_header() {
    if (!empty($_SERVER['HTTP_AUTHORIZATION']))          return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strtolower($k) === 'authorization') return $v;
        }
    }
    return '';
}

switch ($method) {

    // ── GET /auth.php                → check current token → {id,name,email} or 401
    // ── GET /auth.php?setup_check=1  → {setupNeeded: true/false}
    case 'GET':
        if (isset($_GET['setup_check'])) {
            $count = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
            echo json_encode(['setupNeeded' => $count === 0]);
            break;
        }
        $header = get_auth_header();
        if (!preg_match('/^Bearer (.+)$/', $header, $m)) {
            http_response_code(401); echo json_encode(['error' => 'Not authenticated']); exit;
        }
        $stmt = $pdo->prepare("SELECT id, name, email FROM users WHERE api_token = ?");
        $stmt->execute([trim($m[1])]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) { http_response_code(401); echo json_encode(['error' => 'Invalid token']); exit; }
        echo json_encode($user);
        break;

    // ── POST /auth.php             → login {email, password} → {id,name,email,token}
    // ── POST /auth.php?setup=1     → create first user {name,email,password} — only if no users exist
    case 'POST':
        if (isset($_GET['setup'])) {
            $count = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
            if ($count > 0) {
                http_response_code(403); echo json_encode(['error' => 'Setup already completed']); exit;
            }
            $name  = trim($body['name']     ?? '');
            $email = strtolower(trim($body['email'] ?? ''));
            $pass  = $body['password'] ?? '';
            if (!$name || !$email || strlen($pass) < 6) {
                http_response_code(400);
                echo json_encode(['error' => 'name, email and a password of at least 6 characters are required']);
                exit;
            }
            $hash  = password_hash($pass, PASSWORD_DEFAULT);
            $token = bin2hex(random_bytes(32));
            $stmt  = $pdo->prepare("INSERT INTO users (name, email, password_hash, api_token) VALUES (?,?,?,?)");
            $stmt->execute([$name, $email, $hash, $token]);
            $id = (int)$pdo->lastInsertId();
            http_response_code(201);
            echo json_encode(['id' => $id, 'name' => $name, 'email' => $email, 'token' => $token]);
        } else {
            $email = strtolower(trim($body['email'] ?? ''));
            $pass  = $body['password'] ?? '';
            if (!$email || !$pass) {
                http_response_code(400); echo json_encode(['error' => 'email and password required']); exit;
            }
            $stmt = $pdo->prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$user || !password_verify($pass, $user['password_hash'])) {
                http_response_code(401); echo json_encode(['error' => 'Invalid email or password']); exit;
            }
            // Rotate token on every login
            $token = bin2hex(random_bytes(32));
            $pdo->prepare("UPDATE users SET api_token = ? WHERE id = ?")->execute([$token, $user['id']]);
            echo json_encode(['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'token' => $token]);
        }
        break;

    // ── DELETE /auth.php  (via POST?_method=DELETE) → logout, invalidate token
    case 'DELETE':
        $header = get_auth_header();
        if (preg_match('/^Bearer (.+)$/', $header, $m)) {
            $pdo->prepare("UPDATE users SET api_token = NULL WHERE api_token = ?")->execute([trim($m[1])]);
        }
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
}
