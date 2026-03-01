<?php
// ─── meta.php — sector/country/industry metadata for holdings ────────────────
// Strategy: 1) static known-ticker map   (instant, no external calls)
//           2) FMP API                   (dynamic, rate-limited free plan)
//           3) exchange-suffix inference (country only, free)
//           4) give up
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$ticker = strtoupper(trim($_GET['ticker'] ?? ''));
if (!$ticker || !preg_match('/^[A-Za-z0-9.\-=\^]+$/', $ticker)) {
    http_response_code(400); echo json_encode(['error' => 'invalid ticker']); exit;
}

// ── 1. Static map — covers all commonly imported tickers ─────────────────────
// [sector, industry, country]
$STATIC = [
    // ── Technology – Semiconductors ───────────────────────────────────────────
    'NVDA'     => ['Technology', 'Semiconductors',             'United States'],
    'AMD'      => ['Technology', 'Semiconductors',             'United States'],
    'INTC'     => ['Technology', 'Semiconductors',             'United States'],
    'QCOM'     => ['Technology', 'Semiconductors',             'United States'],
    'AVGO'     => ['Technology', 'Semiconductors',             'United States'],
    'LSCC'     => ['Technology', 'Semiconductors',             'United States'],
    'MRVL'     => ['Technology', 'Semiconductors',             'United States'],
    'CRDO'     => ['Technology', 'Semiconductors',             'United States'],
    'MU'       => ['Technology', 'Semiconductors',             'United States'],
    'CAMT'     => ['Technology', 'Semiconductors',             'Israel'],
    'ON'       => ['Technology', 'Semiconductors',             'United States'],
    'TXN'      => ['Technology', 'Semiconductors',             'United States'],
    'TSM'      => ['Technology', 'Semiconductors',             'Taiwan'],
    'ASML'     => ['Technology', 'Semiconductor Equipment',    'Netherlands'],
    'ASML.AS'  => ['Technology', 'Semiconductor Equipment',    'Netherlands'],
    'BESI.AS'  => ['Technology', 'Semiconductor Equipment',    'Netherlands'],
    'LRCX'     => ['Technology', 'Semiconductor Equipment',    'United States'],
    'SMCI'     => ['Technology', 'Computer Hardware',          'United States'],
    // ── Technology – Electronic Components / Optical ─────────────────────────
    'COHR'     => ['Technology', 'Electronic Components',      'United States'],
    'LITE'     => ['Technology', 'Electronic Components',      'United States'],
    'FN'       => ['Technology', 'Electronic Components',      'United States'],
    'CIEN'     => ['Technology', 'Communication Equipment',    'United States'],
    'VRT'      => ['Technology', 'Electronic Components',      'United States'],
    // ── Technology – Software ─────────────────────────────────────────────────
    'MSFT'     => ['Technology', 'Software-Infrastructure',    'United States'],
    'AAPL'     => ['Technology', 'Consumer Electronics',       'United States'],
    'GOOGL'    => ['Communication Services', 'Internet Content & Information', 'United States'],
    'GOOG'     => ['Communication Services', 'Internet Content & Information', 'United States'],
    'META'     => ['Communication Services', 'Internet Content & Information', 'United States'],
    'SNOW'     => ['Technology', 'Software-Application',       'United States'],
    'U'        => ['Technology', 'Software-Application',       'United States'],
    'CRM'      => ['Technology', 'Software-Application',       'United States'],
    'NOW'      => ['Technology', 'Software-Application',       'United States'],
    'PLTR'     => ['Technology', 'Software-Application',       'United States'],
    'PANW'     => ['Technology', 'Software-Infrastructure',    'United States'],
    'ZS'       => ['Technology', 'Software-Infrastructure',    'United States'],
    'DDOG'     => ['Technology', 'Software-Application',       'United States'],
    'HUBS'     => ['Technology', 'Software-Application',       'United States'],
    'ADBE'     => ['Technology', 'Software-Application',       'United States'],
    'ORCL'     => ['Technology', 'Software-Infrastructure',    'United States'],
    'SAP'      => ['Technology', 'Software-Application',       'Germany'],
    'SNPS'     => ['Technology', 'Software-Application',       'United States'],
    'CDNS'     => ['Technology', 'Software-Application',       'United States'],
    'GTLB'     => ['Technology', 'Software-Application',       'United States'],
    'NET'      => ['Technology', 'Software-Infrastructure',    'United States'],
    'UBER'     => ['Technology', 'Software-Application',       'United States'],
    // ── Technology – Quantum Computing ───────────────────────────────────────
    'IONQ'     => ['Technology', 'Quantum Computing',          'United States'],
    'RGTI'     => ['Technology', 'Quantum Computing',          'United States'],
    'QUBT'     => ['Technology', 'Quantum Computing',          'United States'],
    'QBTS'     => ['Technology', 'Quantum Computing',          'United States'],
    // ── Technology – Internet / E-commerce ───────────────────────────────────
    'AMZN'     => ['Consumer Cyclical', 'Internet Retail',     'United States'],
    'MELI'     => ['Consumer Cyclical', 'Internet Retail',     'Argentina'],
    'SE'       => ['Consumer Cyclical', 'Internet Retail',     'Singapore'],
    'BKNG'     => ['Consumer Cyclical', 'Travel Services',     'United States'],
    'ABNB'     => ['Consumer Cyclical', 'Travel Services',     'United States'],
    // ── Consumer Cyclical ─────────────────────────────────────────────────────
    'LULU'     => ['Consumer Cyclical', 'Apparel Retail',      'United States'],
    'CROX'     => ['Consumer Cyclical', 'Footwear & Accessories', 'United States'],
    'CPRT'     => ['Consumer Cyclical', 'Auto & Truck Dealerships', 'United States'],
    // ── Communication Services ────────────────────────────────────────────────
    'NFLX'     => ['Communication Services', 'Entertainment',  'United States'],
    'DIS'      => ['Communication Services', 'Entertainment',  'United States'],
    'RDDT'     => ['Communication Services', 'Internet Content & Information', 'United States'],
    'UMGNF'    => ['Communication Services', 'Entertainment',  'Netherlands'],
    // ── Healthcare ────────────────────────────────────────────────────────────
    'NOVO-B.CO'=> ['Healthcare', 'Drug Manufacturers-General', 'Denmark'],
    'NVO'      => ['Healthcare', 'Drug Manufacturers-General', 'Denmark'],
    'GMAB.CO'  => ['Healthcare', 'Biotechnology',              'Denmark'],
    'LLY'      => ['Healthcare', 'Drug Manufacturers-General', 'United States'],
    'JNJ'      => ['Healthcare', 'Drug Manufacturers-General', 'United States'],
    'ABBV'     => ['Healthcare', 'Drug Manufacturers-General', 'United States'],
    // ── Financial Services ────────────────────────────────────────────────────
    'V'        => ['Financial Services', 'Credit Services',    'United States'],
    'MA'       => ['Financial Services', 'Credit Services',    'United States'],
    'JPM'      => ['Financial Services', 'Banks-Diversified',  'United States'],
    'BRK-B'    => ['Financial Services', 'Insurance-Diversified', 'United States'],
    'NU'       => ['Financial Services', 'Banks-Diversified',  'Brazil'],
    'EXXRF'    => ['Financial Services', 'Asset Management',   'Netherlands'],
    'JYSK.CO'  => ['Financial Services', 'Banks-Regional',     'Denmark'],
    'DANSKE.CO'=> ['Financial Services', 'Banks-Diversified',  'Denmark'],
    // ── Industrials ───────────────────────────────────────────────────────────
    'MLI'      => ['Industrials', 'Metal Fabrication',         'United States'],
    'TDG'      => ['Industrials', 'Aerospace & Defense',       'United States'],
    'MAERSK-B.CO' => ['Industrials', 'Marine Shipping',        'Denmark'],
    'ROCK-B.CO'=> ['Industrials', 'Building Products & Equipment', 'Denmark'],
    'CHG.DE'   => ['Communication Services', 'Internet Content & Information', 'Germany'],
    // ── Consumer Cyclical – Autos ─────────────────────────────────────────────
    'TSLA'     => ['Consumer Cyclical', 'Auto Manufacturers',  'United States'],
    // ── ETFs ─────────────────────────────────────────────────────────────────
    'SCHG'     => ['ETF', 'Large-Cap Growth',                  'United States'],
    'CSU.TO'   => ['Technology', 'Software-Application',       'Canada'],
];

// Grab static map values if present (may still call FMP below for companyName)
$staticSector   = null;
$staticIndustry = null;
$staticCountry  = null;
if (isset($STATIC[$ticker])) {
    [$staticSector, $staticIndustry, $staticCountry] = $STATIC[$ticker];
}

// ── Shared HTTP helper ────────────────────────────────────────────────────────
function http_get(string $url, array $headers = []): array {
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'code' => 0, 'body' => null];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['ok' => $body !== false && $code === 200, 'code' => $code, 'body' => $body ?: null];
}

// ── 2. FMP API lookup ─────────────────────────────────────────────────────────
// API key injected by GitHub Actions from repository secret FMP_API_KEY
$FMP_KEY = '%%FMP_API_KEY%%';

// FMP returns ISO 3166-1 alpha-2 codes; map to full names for display consistency
function fmp_country(string $code): string {
    static $map = [
        'US' => 'United States',      'GB' => 'United Kingdom',   'DE' => 'Germany',
        'FR' => 'France',             'NL' => 'Netherlands',      'DK' => 'Denmark',
        'SE' => 'Sweden',             'NO' => 'Norway',           'FI' => 'Finland',
        'IT' => 'Italy',              'ES' => 'Spain',            'CH' => 'Switzerland',
        'AT' => 'Austria',            'BE' => 'Belgium',          'PT' => 'Portugal',
        'IE' => 'Ireland',            'LU' => 'Luxembourg',       'GR' => 'Greece',
        'CN' => 'China',              'JP' => 'Japan',            'KR' => 'South Korea',
        'TW' => 'Taiwan',             'HK' => 'Hong Kong',        'SG' => 'Singapore',
        'IN' => 'India',              'AU' => 'Australia',        'NZ' => 'New Zealand',
        'CA' => 'Canada',             'MX' => 'Mexico',           'BR' => 'Brazil',
        'AR' => 'Argentina',          'CL' => 'Chile',            'CO' => 'Colombia',
        'IL' => 'Israel',             'ZA' => 'South Africa',     'NG' => 'Nigeria',
        'RU' => 'Russia',             'TR' => 'Turkey',           'SA' => 'Saudi Arabia',
        'AE' => 'United Arab Emirates', 'QA' => 'Qatar',          'EG' => 'Egypt',
        'PA' => 'Panama',             'KY' => 'Cayman Islands',   'BM' => 'Bermuda',
        'VG' => 'British Virgin Islands', 'CY' => 'Cyprus',
    ];
    return $map[strtoupper($code)] ?? $code;
}

// ── 2. FMP API lookup — always called when key is set, to get companyName ─────
// Even if static map has sector/country, FMP provides the company name.
$fmpSector      = null;
$fmpIndustry    = null;
$fmpCountry     = null;
$fmpCompanyName = null;

if ($FMP_KEY !== '%%FMP_API_KEY%%' && $FMP_KEY !== '') {
    // Strip exchange suffix for FMP (it prefers bare symbols, e.g. NOVO-B not NOVO-B.CO)
    $fmpSymbol = preg_replace('/\.[A-Z]{1,3}$/', '', $ticker);
    $fmpUrl    = 'https://financialmodelingprep.com/stable/profile'
               . '?symbol=' . urlencode($fmpSymbol)
               . '&apikey=' . urlencode($FMP_KEY);
    $fmp = http_get($fmpUrl);
    if (isset($_GET['debug'])) { echo $fmp['body']; exit; }
    if ($fmp['ok'] && $fmp['body']) {
        $data = json_decode($fmp['body'], true);
        $p    = is_array($data) ? ($data[0] ?? null) : null;
        if ($p) {
            $fmpSector      = $p['sector']      ?: null;
            $fmpIndustry    = $p['industry']    ?: null;
            $fmpCountry     = !empty($p['country']) ? fmp_country($p['country']) : null;
            $fmpCompanyName = $p['companyName'] ?: null;
        }
    }
}

// Merge: static map wins for sector/country/industry; FMP provides companyName
// (and sector/country as fallback when not in static map)
$sector      = $staticSector   ?? $fmpSector;
$industry    = $staticIndustry ?? $fmpIndustry;
$country     = $staticCountry  ?? $fmpCountry;
$companyName = $fmpCompanyName;

if ($sector !== null || $country !== null || $companyName !== null) {
    echo json_encode(compact('sector', 'industry', 'country', 'companyName'));
    exit;
}

// ── 3. Country inference from ticker exchange suffix ─────────────────────────
function infer_country(string $ticker): ?string {
    if (str_contains($ticker, '.CO'))  return 'Denmark';
    if (str_contains($ticker, '.AS'))  return 'Netherlands';
    if (str_contains($ticker, '.ST'))  return 'Sweden';
    if (str_contains($ticker, '.HE'))  return 'Finland';
    if (str_contains($ticker, '.OL'))  return 'Norway';
    if (str_contains($ticker, '.L'))   return 'United Kingdom';
    if (str_contains($ticker, '.PA'))  return 'France';
    if (str_contains($ticker, '.DE') || str_contains($ticker, '.F')) return 'Germany';
    if (str_contains($ticker, '.MI'))  return 'Italy';
    if (str_contains($ticker, '.MC'))  return 'Spain';
    if (str_contains($ticker, '.SW'))  return 'Switzerland';
    if (str_contains($ticker, '.AX'))  return 'Australia';
    if (str_contains($ticker, '.T'))   return 'Japan';
    if (str_contains($ticker, '.HK'))  return 'Hong Kong';
    if (str_contains($ticker, '.SS') || str_contains($ticker, '.SZ')) return 'China';
    if (str_contains($ticker, '.KS') || str_contains($ticker, '.KQ')) return 'South Korea';
    if (str_contains($ticker, '.TW') || str_contains($ticker, '.TWO')) return 'Taiwan';
    if (str_contains($ticker, '.NS') || str_contains($ticker, '.BO'))  return 'India';
    if (str_contains($ticker, '.SA'))  return 'Brazil';
    if (str_contains($ticker, '.MX'))  return 'Mexico';
    if (str_contains($ticker, '.TO') || str_contains($ticker, '.V'))   return 'Canada';
    return null;
}

$inferredCountry = infer_country($ticker);
if ($inferredCountry) {
    echo json_encode([
        'sector'      => null,
        'industry'    => null,
        'country'     => $inferredCountry,
        'companyName' => null,
    ]);
    exit;
}

// ── 4. Give up ────────────────────────────────────────────────────────────────
http_response_code(404);
echo json_encode(['error' => 'metadata unavailable', 'ticker' => $ticker]);
