This project attempts to reduce the burdens that the creation of testamentary instruments often cause marginalized populations.
This project employs Python to create a will in accordance with the Massachusetts Law Libraries' template for a single person.

## Forex Trading Dashboard

`forex_app.py` is a paper-trading dashboard for USDTRY, USDCNH, and USDINR. It includes:

- **Trade execution** — simulated market orders with bid/ask spread, 20:1 leverage, margin checks, stop loss / take profit automation, open-position P&L, and trade history.
- **Sentiment analysis** — paste news headlines or central-bank commentary and a forex-specific lexicon scores it bullish/bearish for each pair, with a recency-weighted aggregate per pair.
- **Fundamental analysis** — editable macro indicators (policy rate, inflation, GDP growth, current account, debt, reserves) for USD, TRY, CNH, and INR, scored into a per-pair outlook via real-rate, inflation, growth, external-balance, and debt differentials.
- **Rates** — anchored to a free live FX API when reachable, with a simulated random walk fallback (CNH is proxied by onshore CNY in live data).

Run it:

```bash
pip install -r requirements.txt
python forex_app.py   # serves on http://localhost:5001
```

This is a simulator for education/practice only — no real money is traded and nothing in it is financial advice.
