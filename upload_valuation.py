"""
upload_valuation.py — seed all 3 valuation models into the database.

Usage:
    python upload_valuation.py --token YOUR_API_TOKEN [--portfolio-id 1] [--host https://labanos.dk]

The script POSTs structured JSON to /valuations.php for AAPL, NOVO-B, and BRK-B.
It will upsert (replace) any existing model for each ticker on the model_date.
"""

import argparse
import json
import urllib.request
import urllib.error
import sys

# ── CLI args ───────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Seed valuation models into investtracker DB")
parser.add_argument("--token",        required=True,  help="API Bearer token (from user account)")
parser.add_argument("--portfolio-id", type=int, default=1, help="Portfolio ID to attach models to")
parser.add_argument("--host",         default="https://labanos.dk", help="Base URL of the API host")
args = parser.parse_args()

API_URL    = f"{args.host}/valuations.php"
TOKEN      = args.token
PORTFOLIO  = args.portfolio_id
MODEL_DATE = "2026-03-03"   # Date models were built


# ── Helper: POST to API ────────────────────────────────────────────────────────

def upload(payload):
    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read().decode("utf-8"))
            return True, resp
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        return False, {"http_status": e.code, "body": body_err}
    except Exception as e:
        return False, {"error": str(e)}


def fmt_multiples(multiples, weights):
    """Convert parallel lists into the JSON array the DB expects."""
    return [{"multiple": m, "weight": w} for m, w in zip(multiples, weights)]


# ══════════════════════════════════════════════════════════════════════════════
#  1.  Apple Inc. (AAPL)
#  Currency: USD millions  |  FY end: September  |  Source: 10-K FY2023-FY2025
# ══════════════════════════════════════════════════════════════════════════════

aapl_payload = {
    "portfolio_id": PORTFOLIO,
    "ticker":       "AAPL",
    "model_date":   MODEL_DATE,
    "currency":     "USD",
    "notes": (
        "FY end September. All figures in USD millions. "
        "FY2025 EPS $7.46 diluted. Current P/E ~35.5x. "
        "5-yr rev CAGR FY21-25 ≈ 3.3%; recent FY24→25 = 6.4%. "
        "Share count declining ~2-3%/yr via aggressive buybacks. "
        "Services mix (~27% of rev) driving margin expansion."
    ),
    "actuals": [
        {"label": "Y-2", "fiscal_year": 2023, "revenue": 383285, "gross_profit": 169148, "op_income": 114301, "net_income":  96995, "shares": 15744},
        {"label": "Y-1", "fiscal_year": 2024, "revenue": 391035, "gross_profit": 180683, "op_income": 123216, "net_income":  93736, "shares": 15344},
        {"label": "Y0",  "fiscal_year": 2025, "revenue": 416161, "gross_profit": 195201, "op_income": 133050, "net_income": 112010, "shares": 14949},
    ],
    "scenarios": [
        {
            "scenario":        "bear",
            "scenario_weight": 0.25,
            "current_price":   264.72,
            "rev_growth":      0.03,   # Macro headwinds, China weakness
            "tgt_gm":          0.45,   # Margin pressure from hardware mix
            "tgt_om":          0.28,   # Increased AI & R&D spend
            "op_conv":         0.80,   # Higher taxes, rising interest expense
            "shr_chg":        -0.015,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.30,
            "multiples": fmt_multiples(
                [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
                [0.025, 0.05, 0.10, 0.20, 0.225, 0.175, 0.10, 0.075, 0.04, 0.01],
            ),
        },
        {
            "scenario":        "base",
            "scenario_weight": 0.50,
            "current_price":   264.72,
            "rev_growth":      0.07,   # Services mix + hardware refresh
            "tgt_gm":          0.48,   # Gradual improvement as services grow
            "tgt_om":          0.35,   # Operating leverage from services
            "op_conv":         0.84,
            "shr_chg":        -0.025,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.20,
            "multiples": fmt_multiples(
                [22, 25, 27, 30, 33, 35, 38, 40, 42, 45],
                [0.025, 0.05, 0.10, 0.15, 0.20, 0.175, 0.15, 0.075, 0.05, 0.025],
            ),
        },
        {
            "scenario":        "bull",
            "scenario_weight": 0.25,
            "current_price":   264.72,
            "rev_growth":      0.12,   # AI iPhone supercycle + Vision Pro + services
            "tgt_gm":          0.52,   # Software/services reaching ~50%+ of revenue
            "tgt_om":          0.40,   # High operating leverage in services
            "op_conv":         0.85,
            "shr_chg":        -0.035,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.15,
            "multiples": fmt_multiples(
                [28, 30, 33, 35, 38, 40, 42, 45, 48, 52],
                [0.02, 0.04, 0.075, 0.10, 0.15, 0.20, 0.175, 0.125, 0.085, 0.03],
            ),
        },
    ],
    "history": [
        {"fiscal_year": 2019, "revenue": 260174, "gross_profit":  98392, "op_income":  63930, "net_income":  55256, "shares": 17273},
        {"fiscal_year": 2020, "revenue": 274515, "gross_profit": 104956, "op_income":  66288, "net_income":  57411, "shares": 16976},
        {"fiscal_year": 2021, "revenue": 365817, "gross_profit": 152836, "op_income": 108949, "net_income":  94680, "shares": 16865},
        {"fiscal_year": 2022, "revenue": 394328, "gross_profit": 170782, "op_income": 119437, "net_income":  99803, "shares": 16326},
        {"fiscal_year": 2023, "revenue": 383285, "gross_profit": 169148, "op_income": 114301, "net_income":  96995, "shares": 15813},
        {"fiscal_year": 2024, "revenue": 391035, "gross_profit": 180683, "op_income": 123216, "net_income":  93736, "shares": 15408},
        {"fiscal_year": 2025, "revenue": 416161, "gross_profit": 195201, "op_income": 133050, "net_income": 112010, "shares": 15005},
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
#  2.  Novo Nordisk A/S (NOVO-B)
#  Currency: DKK millions  |  FY end: December  |  Source: Annual Reports
# ══════════════════════════════════════════════════════════════════════════════

novo_payload = {
    "portfolio_id": PORTFOLIO,
    "ticker":       "NOVO-B",
    "model_date":   MODEL_DATE,
    "currency":     "DKK",
    "notes": (
        "FY end December. All figures in DKK millions. "
        "Stock down ~74% from mid-2024 peak (~900 DKK) driven by: "
        "CagriSema Phase 3 miss, Eli Lilly competition, sema Alzheimer's failure, GM compression. "
        "FY2025 EPS 23.04 DKK diluted. Trailing P/E ~10.3x (historically 30-40x). "
        "FY2026 guidance: ~-1% reported revenue; operating profit +11% (cost transformation). "
        "Key headwinds: MFN pricing, Loss of Exclusivity semaglutide. "
        "Key upside: amycretin Phase 3, GLP-1 TAM <5% penetrated."
    ),
    "actuals": [
        {"label": "Y-2", "fiscal_year": 2023, "revenue": 232261, "gross_profit": 196496, "op_income": 102574, "net_income":  83683, "shares": 4495},
        {"label": "Y-1", "fiscal_year": 2024, "revenue": 290403, "gross_profit": 245881, "op_income": 128339, "net_income": 100988, "shares": 4462},
        {"label": "Y0",  "fiscal_year": 2025, "revenue": 309064, "gross_profit": 250342, "op_income": 127658, "net_income": 102434, "shares": 4446},
    ],
    "scenarios": [
        {
            "scenario":        "bear",
            "scenario_weight": 0.30,
            "current_price":   237.40,
            "rev_growth":      0.00,   # Flat: MFN + LOE + competition = structural reset
            "tgt_gm":          0.79,   # Structural COGS pressure
            "tgt_om":          0.35,   # Heavy R&D + elevated COGS
            "op_conv":         0.79,
            "shr_chg":        -0.003,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.30,
            "multiples": fmt_multiples(
                [5, 6, 8, 10, 12, 14, 16, 18, 20, 22],
                [0.02, 0.05, 0.15, 0.225, 0.20, 0.15, 0.10, 0.065, 0.03, 0.01],
            ),
        },
        {
            "scenario":        "base",
            "scenario_weight": 0.40,
            "current_price":   237.40,
            "rev_growth":      0.05,   # Y1 flat, Y2-5 recovery as oral sema ramps
            "tgt_gm":          0.82,   # Partial GM recovery as manufacturing normalises
            "tgt_om":          0.43,   # Improvement via cost transformation
            "op_conv":         0.80,
            "shr_chg":        -0.010,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.20,
            "multiples": fmt_multiples(
                [12, 15, 18, 20, 22, 25, 28, 30, 33, 35],
                [0.025, 0.05, 0.10, 0.15, 0.20, 0.20, 0.15, 0.075, 0.035, 0.015],
            ),
        },
        {
            "scenario":        "bull",
            "scenario_weight": 0.30,
            "current_price":   237.40,
            "rev_growth":      0.10,   # Y1 flat then strong recovery on new drug approvals
            "tgt_gm":          0.84,   # Full manufacturing normalisation + mix shift
            "tgt_om":          0.45,   # Return to FY2024 levels
            "op_conv":         0.80,
            "shr_chg":        -0.018,
            "proj_years":      5,
            "disc_rt":         0.08,
            "mos":             0.15,
            "multiples": fmt_multiples(
                [20, 22, 25, 28, 30, 33, 35, 38, 42, 45],
                [0.02, 0.03, 0.075, 0.10, 0.15, 0.20, 0.175, 0.125, 0.095, 0.03],
            ),
        },
    ],
    "history": [
        {"fiscal_year": 2019, "revenue": 122021, "gross_profit": 103235, "op_income":  55855, "net_income":  43008, "shares": 4663},
        {"fiscal_year": 2020, "revenue": 126946, "gross_profit": 107120, "op_income":  58630, "net_income":  44681, "shares": 4582},
        {"fiscal_year": 2021, "revenue": 140801, "gross_profit": 118900, "op_income":  65706, "net_income":  47758, "shares": 4541},
        {"fiscal_year": 2022, "revenue": 176954, "gross_profit": 148506, "op_income":  74809, "net_income":  55525, "shares": 4545},
        {"fiscal_year": 2023, "revenue": 232261, "gross_profit": 196496, "op_income": 102574, "net_income":  83683, "shares": 4495},
        {"fiscal_year": 2024, "revenue": 290403, "gross_profit": 245881, "op_income": 128339, "net_income": 100988, "shares": 4462},
        {"fiscal_year": 2025, "revenue": 309064, "gross_profit": 250342, "op_income": 127658, "net_income": 102434, "shares": 4446},
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
#  3.  Berkshire Hathaway Inc. (BRK-B)
#  Currency: USD millions  |  FY end: December  |  Earnings: Operating (excl. invest. gains)
#  Shares: Class B equivalent (Class A × 1,500)
# ══════════════════════════════════════════════════════════════════════════════

brk_payload = {
    "portfolio_id": PORTFOLIO,
    "ticker":       "BRK-B",
    "model_date":   MODEL_DATE,
    "currency":     "USD",
    "notes": (
        "FY end December. All figures in USD millions. "
        "IMPORTANT: NI = Operating Earnings (excl. GAAP investment gains/losses). "
        "Gross profit estimated at ~22% blended GM (not a reported figure). "
        "Shares = Class B equivalent (Class A equiv × 1,500). "
        "FY2025 op EPS $20.62/B share. Operating P/E ~23.3x. "
        "⚠ This model materially UNDERSTATES fair value: excludes ~$155/B cash + $370B+ equity portfolio. "
        "Greg Abel became CEO in 2026. Cash hoard record ~$334B at Q3 2025."
    ),
    "actuals": [
        {"label": "Y-2", "fiscal_year": 2023, "revenue": 364482, "gross_profit":  80186, "op_income":  47342, "net_income": 37400, "shares": 2175},
        {"label": "Y-1", "fiscal_year": 2024, "revenue": 371433, "gross_profit":  81715, "op_income":  60047, "net_income": 47437, "shares": 2158},
        {"label": "Y0",  "fiscal_year": 2025, "revenue": 372100, "gross_profit":  81862, "op_income":  56316, "net_income": 44490, "shares": 2157},
    ],
    "scenarios": [
        {
            "scenario":        "bear",
            "scenario_weight": 0.25,
            "current_price":   480.50,
            "rev_growth":      0.01,   # Near-stagnant; BNSF down, insurance flat
            "tgt_gm":          0.21,   # Weak insurance underwriting compresses GM
            "tgt_om":          0.11,   # Structural margin compression
            "op_conv":         0.79,
            "shr_chg":         0.00,   # No buybacks — preserve cash
            "proj_years":      5,
            "disc_rt":         0.07,
            "mos":             0.20,
            "multiples": fmt_multiples(
                [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
                [0.025, 0.05, 0.125, 0.225, 0.225, 0.15, 0.10, 0.065, 0.025, 0.01],
            ),
        },
        {
            "scenario":        "base",
            "scenario_weight": 0.50,
            "current_price":   480.50,
            "rev_growth":      0.03,   # Slow growth — mature compounder
            "tgt_gm":          0.22,   # Stable blended GM estimate
            "tgt_om":          0.14,   # Slight improvement as insurance normalises
            "op_conv":         0.79,
            "shr_chg":        -0.005,
            "proj_years":      5,
            "disc_rt":         0.07,
            "mos":             0.15,
            "multiples": fmt_multiples(
                [16, 18, 20, 22, 24, 26, 28, 30, 32, 35],
                [0.025, 0.05, 0.10, 0.15, 0.20, 0.20, 0.15, 0.075, 0.035, 0.015],
            ),
        },
        {
            "scenario":        "bull",
            "scenario_weight": 0.25,
            "current_price":   480.50,
            "rev_growth":      0.07,   # Major acquisition + insurance recovery
            "tgt_gm":          0.25,   # Strong underwriting + higher-margin acquisition
            "tgt_om":          0.17,   # Operating leverage; cash fully deployed
            "op_conv":         0.79,
            "shr_chg":        -0.010,
            "proj_years":      5,
            "disc_rt":         0.07,
            "mos":             0.15,
            "multiples": fmt_multiples(
                [22, 24, 26, 28, 30, 32, 35, 38, 40, 42],
                [0.02, 0.04, 0.10, 0.15, 0.20, 0.20, 0.15, 0.085, 0.04, 0.015],
            ),
        },
    ],
    "history": [
        {"fiscal_year": 2019, "revenue": 254616, "gross_profit":  56015, "op_income":  30380, "net_income": 24000, "shares": 2414},
        {"fiscal_year": 2020, "revenue": 245510, "gross_profit":  54012, "op_income":  27744, "net_income": 21918, "shares": 2374},
        {"fiscal_year": 2021, "revenue": 276094, "gross_profit":  60741, "op_income":  34753, "net_income": 27455, "shares": 2312},
        {"fiscal_year": 2022, "revenue": 302089, "gross_profit":  66460, "op_income":  39051, "net_income": 30850, "shares": 2255},
        {"fiscal_year": 2023, "revenue": 364482, "gross_profit":  80186, "op_income":  47342, "net_income": 37400, "shares": 2175},
        {"fiscal_year": 2024, "revenue": 371433, "gross_profit":  81715, "op_income":  60047, "net_income": 47437, "shares": 2158},
        {"fiscal_year": 2025, "revenue": 372100, "gross_profit":  81862, "op_income":  56316, "net_income": 44490, "shares": 2157},
    ],
}


# ── Upload all three ───────────────────────────────────────────────────────────

models = [
    ("AAPL",   aapl_payload),
    ("NOVO-B", novo_payload),
    ("BRK-B",  brk_payload),
]

all_ok = True
for ticker, payload in models:
    print(f"Uploading {ticker} ... ", end="", flush=True)
    ok, resp = upload(payload)
    if ok and resp.get("ok"):
        print(f"✓  model_id={resp.get('model_id')}")
    else:
        print(f"✗  FAILED")
        print(f"   {json.dumps(resp, indent=2)}")
        all_ok = False

print()
if all_ok:
    print("All 3 models seeded successfully.")
else:
    print("One or more models failed — check errors above.")
    sys.exit(1)
