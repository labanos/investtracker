<?php
// ─── meta.php — server-side proxy for Yahoo Finance quoteSummary ────────────
// Returns sector, industry, country for a single ticker.
// Called from the frontend to avoid CORS/auth blocks on the YF API.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$ticker = trim($_GET['ticker'] ?? '');
if (!$ticker || !preg_match('/^[A-Za-z0-9.\-=\^]+$/', $ticker)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid ticker']);
    exit;
}

$url = "https://query2.finance.yahoo.com/v1/finance/quoteSummary/" . urlencode($ticker) . "?modules=assetProfile";

$ctx = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 10,
        'header'  => implode("\r\n", [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept: application/json, text/plain, */*',
            'Accept-Language: en-US,en;q=0.9',
            'Referer: https://finance.yahoo.com/',
        ]),
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$body = @file_get_contents($url, false, $ctx);
if ($body === false) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream fetch failed']);
    exit;
}

$data    = json_decode($body, true);
$profile = $data['quoteSummary']['result'][0]['assetProfile'] ?? null;

if (!$profile) {
    // Return nulls — frontend will show 'Unknown'
    echo json_encode(['sector' => null, 'industry' => null, 'country' => null]);
    exit;
}

echo json_encode([
    'sector'   => $profile['sector']   ?? null,
    'industry' => $profile['industry'] ?? null,
    'country'  => $profile['country']  ?? null,
]);
