<?php
// ─── meta.php — server-side proxy for Yahoo Finance quoteSummary ────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$ticker = trim($_GET['ticker'] ?? '');
if (!$ticker || !preg_match('/^[A-Za-z0-9.\-=\^]+$/', $ticker)) {
    http_response_code(400); echo json_encode(['error' => 'invalid ticker']); exit;
}

$debug = isset($_GET['debug']);

function yf_fetch($url) {
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'code' => 0, 'error' => 'curl not available', 'body' => null];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json, text/plain, */*',
            'Accept-Language: en-US,en;q=0.9',
            'Referer: https://finance.yahoo.com/',
        ],
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['ok' => $body !== false && $code === 200, 'code' => $code, 'error' => $err ?: null, 'body' => $body ?: null];
}

$yfUrl  = "https://query2.finance.yahoo.com/v1/finance/quoteSummary/" . urlencode($ticker) . "?modules=assetProfile";
$result = yf_fetch($yfUrl);

if ($debug) {
    echo json_encode([
        'curl_available'  => function_exists('curl_init'),
        'allow_url_fopen' => ini_get('allow_url_fopen'),
        'url'    => $yfUrl,
        'code'   => $result['code'],
        'error'  => $result['error'],
        'body'   => $result['body'] ? substr($result['body'], 0, 400) : null,
    ], JSON_PRETTY_PRINT);
    exit;
}

if ($result['ok']) {
    $data    = json_decode($result['body'], true);
    $profile = $data['quoteSummary']['result'][0]['assetProfile'] ?? null;
    if ($profile) {
        echo json_encode([
            'sector'   => $profile['sector']   ?? null,
            'industry' => $profile['industry'] ?? null,
            'country'  => $profile['country']  ?? null,
        ]);
        exit;
    }
}

http_response_code(502);
echo json_encode(['error' => 'upstream fetch failed', 'code' => $result['code'], 'curlError' => $result['error']]);
