# FundamentalSentimentEA — MetaTrader 5

An Expert Advisor that trades **USDTRY, USDCNH, and USDINR** on a blend of:

1. **Live fundamentals + sentiment** polled from the companion dashboard
   (`forex_app.py` → `/api/signal/plain`). You keep the dashboard fed with
   news (Sentiment tab) and updated macro prints (Fundamentals tab); the EA
   picks the resulting score up automatically.
2. **A thesis bias** you set per chart, encoding a structural view in
   [-1, +1] where **positive = USD strengthens** against the counter
   currency.

Blended score = `0.6 × dashboard signal + 0.4 × thesis` (weights are
inputs). The EA opens when |score| crosses the entry threshold, exits when
the score fades or flips, sizes positions off a fixed equity-risk
percentage, and places ATR-based stops and targets.

## Setup

1. Run the dashboard: `python forex_app.py` (serves on port 5001).
2. Copy `FundamentalSentimentEA.mq5` into your terminal's
   `MQL5/Experts/` folder and compile it in MetaEditor (F7).
3. In MT5: **Tools → Options → Expert Advisors → Allow WebRequest for
   listed URL** and add `http://127.0.0.1:5001` (use the machine's IP if
   MT5 runs on a different box than the dashboard).
4. Open one chart per pair (your broker's symbol may carry a suffix, e.g.
   `USDTRY.r` — that's handled automatically; use the *Pair name* input to
   override if your broker uses a prefix instead).
5. Attach the EA to each chart with the preset below (or load the matching
   `.set` file), enable Algo Trading, and confirm the chart comment shows
   `Signal source: dashboard`.

## Thesis presets

For the thesis "American decline benefits China; ecological stress weighs
on the Global South":

| Chart  | ThesisBias | Meaning |
|--------|-----------:|---------|
| USDCNH | **−0.8** | Structural short USD vs CNH (China benefits from US decline) |
| USDTRY | **+0.8** | Structural long USD vs TRY (climate/ecological stress on Türkiye) |
| USDINR | **+0.8** | Structural long USD vs INR (climate/ecological stress on India) |

Use ±0.5 instead of ±0.8 if you want the live dashboard signal to dominate;
±1.0 makes the thesis nearly always pass the entry threshold on its own.
`.set` files with these presets are in this folder.

## Important practical caveats

- **Carry/swap will fight the USDTRY thesis.** Long USDTRY means you are
  short the lira while Turkish policy rates are far above US rates —
  brokers typically charge very large negative swap on long USDTRY
  positions (often tens of percent annualized). A slow-burn structural
  thesis can be entirely consumed by carry even if the direction is right.
  Check your broker's swap rates (right-click symbol → Specification) and
  consider whether the position horizon survives them. Long USDINR also
  carries a smaller negative swap; short USDCNH is usually close to flat.
- **Exotic spreads are wide.** The `MaxSpreadPoints` input skips entries
  when the spread blows out (common on TRY around local news and at
  rollover). Tune it per symbol.
- **USDINR availability.** Many retail brokers quote USDINR as
  indicative-only or don't offer it at all; the EA refuses to trade
  symbols not in full trading mode.
- **Strategy Tester.** `WebRequest` is disabled in the tester, so backtests
  run in thesis-only mode (set `AllowThesisOnly = true`). That backtests
  the structural view and the risk machinery, not the sentiment feed.
- **One position per symbol.** The EA manages a single net position per
  chart, tagged by magic number, and will close/reverse when the blended
  score flips past the entry threshold.

This is educational software, not financial advice. Trade on a demo
account first.
