//+------------------------------------------------------------------+
//|                                       FundamentalSentimentEA.mq5 |
//|  Trades USDTRY, USDCNH, and USDINR on a blend of:                |
//|   1. A live fundamentals + sentiment signal polled from the      |
//|      companion Flask dashboard (forex_app.py, /api/signal/plain) |
//|   2. A per-chart "thesis bias" input encoding a structural view  |
//|      (e.g. short-USD bias on USDCNH, long-USD bias on USDTRY).   |
//|                                                                  |
//|  Attach one instance per chart. If the dashboard API is not      |
//|  reachable (or in the Strategy Tester, where WebRequest is       |
//|  unavailable), the EA can trade on the thesis bias alone.        |
//|                                                                  |
//|  Educational software. Exotic pairs carry wide spreads and       |
//|  heavy swap/carry costs — see metatrader/README.md. Not          |
//|  financial advice.                                               |
//+------------------------------------------------------------------+
#property copyright   "ma-will forex dashboard companion"
#property version     "1.00"
#property description "Fundamentals + sentiment + thesis EA for USDTRY/USDCNH/USDINR"
#property strict

#include <Trade/Trade.mqh>

//--- Signal source -------------------------------------------------
input group "=== Signal Source ==="
input string InpSignalURL      = "http://127.0.0.1:5001/api/signal/plain"; // Dashboard signal URL
input int    InpRefreshSeconds = 60;       // Poll interval (seconds)
input string InpPairOverride   = "";       // Pair name in feed (blank = first 6 chars of symbol)
input bool   InpAllowThesisOnly = true;    // Trade on thesis alone if API unreachable

//--- Thesis --------------------------------------------------------
input group "=== Thesis ==="
input double InpThesisBias   = 0.0;        // Thesis bias -1..+1 (+ = USD strengthens vs counter)
input double InpSignalWeight = 0.6;        // Weight of dashboard signal
input double InpThesisWeight = 0.4;        // Weight of thesis bias

//--- Entry / exit --------------------------------------------------
input group "=== Entry / Exit ==="
input double InpEntryThreshold = 0.30;     // Open when |score| exceeds this
input double InpExitThreshold  = 0.10;     // Close when |score| falls below this
input bool   InpAllowLong      = true;     // Allow long (buy USD vs counter)
input bool   InpAllowShort     = true;     // Allow short (sell USD vs counter)
input bool   InpReverseOnFlip  = true;     // Close and reverse if score flips past threshold

//--- Risk ----------------------------------------------------------
input group "=== Risk ==="
input double          InpRiskPercent     = 1.0;   // Risk per trade (% of equity)
input double          InpMaxLots         = 5.0;   // Hard cap on position size
input ENUM_TIMEFRAMES InpATRTimeframe    = PERIOD_H4; // ATR timeframe
input int             InpATRPeriod       = 14;    // ATR period
input double          InpSL_ATR_Mult     = 2.0;   // Stop loss = ATR x this
input double          InpTP_ATR_Mult     = 3.0;   // Take profit = ATR x this (0 = none)
input double          InpMaxSpreadPoints = 400;   // Skip entries if spread wider (points)
input long            InpMagicNumber     = 20260610; // Magic number

//--- Globals -------------------------------------------------------
CTrade   g_trade;
int      g_atr_handle      = INVALID_HANDLE;
string   g_pair            = "";      // pair name as it appears in the feed
double   g_signal_combined = 0.0;     // last value fetched from dashboard
double   g_signal_fund     = 0.0;
double   g_signal_sent     = 0.0;
bool     g_signal_fresh    = false;   // true if last poll succeeded
datetime g_signal_time     = 0;
bool     g_warned_webrequest = false;

//+------------------------------------------------------------------+
int OnInit()
{
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(30);

   if(InpPairOverride != "")
      g_pair = InpPairOverride;
   else
   {
      // Broker symbols are usually PAIR or PAIR+suffix (e.g. USDTRY.r)
      string s = _Symbol;
      StringToUpper(s);
      g_pair = StringSubstr(s, 0, 6);
   }

   if(InpSignalWeight + InpThesisWeight <= 0)
   {
      Print("SignalWeight + ThesisWeight must be > 0");
      return INIT_PARAMETERS_INCORRECT;
   }

   g_atr_handle = iATR(_Symbol, InpATRTimeframe, InpATRPeriod);
   if(g_atr_handle == INVALID_HANDLE)
   {
      Print("Failed to create ATR indicator");
      return INIT_FAILED;
   }

   EventSetTimer(MathMax(5, InpRefreshSeconds));
   PollSignal();
   Evaluate();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_atr_handle != INVALID_HANDLE)
      IndicatorRelease(g_atr_handle);
   Comment("");
}

//+------------------------------------------------------------------+
void OnTimer()
{
   PollSignal();
   Evaluate();
}

//+------------------------------------------------------------------+
//| Fetch the plain-text signal feed and parse this chart's line     |
//+------------------------------------------------------------------+
void PollSignal()
{
   char   post[];
   char   result[];
   string headers;
   ResetLastError();
   int status = WebRequest("GET", InpSignalURL, "", 3000, post, result, headers);

   if(status == -1)
   {
      g_signal_fresh = false;
      if(!g_warned_webrequest)
      {
         g_warned_webrequest = true;
         Print("WebRequest failed (error ", GetLastError(), "). Add '", InpSignalURL,
               "' to Tools > Options > Expert Advisors > Allow WebRequest for listed URL. ",
               InpAllowThesisOnly ? "Trading on thesis bias only." : "Trading paused.");
      }
      return;
   }
   if(status != 200)
   {
      g_signal_fresh = false;
      Print("Signal feed returned HTTP ", status);
      return;
   }

   string body = CharArrayToString(result, 0, -1, CP_UTF8);
   string lines[];
   int n = StringSplit(body, '\n', lines);
   for(int i = 0; i < n; i++)
   {
      string fields[];
      if(StringSplit(lines[i], ',', fields) < 5)
         continue;
      string pair = fields[0];
      StringTrimLeft(pair);
      StringTrimRight(pair);
      StringToUpper(pair);
      if(pair != g_pair)
         continue;
      g_signal_combined = StringToDouble(fields[1]);
      g_signal_fund     = StringToDouble(fields[2]);
      g_signal_sent     = StringToDouble(fields[3]);
      g_signal_fresh    = true;
      g_signal_time     = TimeCurrent();
      return;
   }
   g_signal_fresh = false;
   Print("Pair ", g_pair, " not found in signal feed");
}

//+------------------------------------------------------------------+
//| Blended score in [-1, 1]; positive = long USD vs counter         |
//+------------------------------------------------------------------+
bool CurrentScore(double &score)
{
   double wsum = InpSignalWeight + InpThesisWeight;
   if(g_signal_fresh)
   {
      score = (InpSignalWeight * g_signal_combined + InpThesisWeight * InpThesisBias) / wsum;
      return true;
   }
   if(InpAllowThesisOnly)
   {
      score = InpThesisBias;
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Main decision logic                                              |
//+------------------------------------------------------------------+
void Evaluate()
{
   double score;
   bool tradable = CurrentScore(score);
   UpdateComment(score, tradable);
   if(!tradable)
      return;

   long dir = OpenDirection(); // 1 long, -1 short, 0 flat

   if(dir != 0)
   {
      bool exit_weak = MathAbs(score) < InpExitThreshold;
      bool flipped   = InpReverseOnFlip &&
                       ((dir > 0 && score < -InpEntryThreshold) ||
                        (dir < 0 && score >  InpEntryThreshold));
      if(exit_weak || flipped)
      {
         ClosePosition(exit_weak ? "signal faded" : "signal flipped");
         dir = 0;
         if(!flipped)
            return;
      }
      else
         return; // hold
   }

   if(dir == 0)
   {
      if(score >= InpEntryThreshold && InpAllowLong)
         OpenPosition(ORDER_TYPE_BUY, score);
      else if(score <= -InpEntryThreshold && InpAllowShort)
         OpenPosition(ORDER_TYPE_SELL, score);
   }
}

//+------------------------------------------------------------------+
//| Direction of this EA's open position on this symbol              |
//+------------------------------------------------------------------+
long OpenDirection()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;
      return PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1;
   }
   return 0;
}

//+------------------------------------------------------------------+
void ClosePosition(const string reason)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagicNumber) continue;
      if(g_trade.PositionClose(ticket))
         Print("Closed ", _Symbol, " position (", reason, ")");
      else
         Print("Close failed for ", _Symbol, ": ", g_trade.ResultRetcodeDescription());
   }
}

//+------------------------------------------------------------------+
void OpenPosition(ENUM_ORDER_TYPE type, double score)
{
   if(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_FULL)
   {
      Print(_Symbol, " is not fully tradable with this broker");
      return;
   }

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0 || ask <= 0 || bid <= 0)
      return;

   double spread_points = (ask - bid) / point;
   if(spread_points > InpMaxSpreadPoints)
   {
      Print("Entry skipped: spread ", DoubleToString(spread_points, 0),
            " points exceeds limit ", DoubleToString(InpMaxSpreadPoints, 0));
      return;
   }

   double atr[];
   if(CopyBuffer(g_atr_handle, 0, 1, 1, atr) != 1 || atr[0] <= 0)
   {
      Print("ATR not ready, entry skipped");
      return;
   }

   double sl_dist = atr[0] * InpSL_ATR_Mult;
   double tp_dist = atr[0] * InpTP_ATR_Mult;
   double price   = (type == ORDER_TYPE_BUY) ? ask : bid;
   double sl      = (type == ORDER_TYPE_BUY) ? price - sl_dist : price + sl_dist;
   double tp      = 0;
   if(InpTP_ATR_Mult > 0)
      tp = (type == ORDER_TYPE_BUY) ? price + tp_dist : price - tp_dist;

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);

   double lots = CalcLots(sl_dist);
   if(lots <= 0)
   {
      Print("Lot size calculation failed, entry skipped");
      return;
   }

   string comment = StringFormat("FS score %.2f", score);
   bool ok = (type == ORDER_TYPE_BUY)
             ? g_trade.Buy(lots, _Symbol, 0, sl, tp, comment)
             : g_trade.Sell(lots, _Symbol, 0, sl, tp, comment);
   if(ok)
      Print("Opened ", EnumToString(type), " ", DoubleToString(lots, 2), " ",
            _Symbol, " (score ", DoubleToString(score, 2), ")");
   else
      Print("Order failed: ", g_trade.ResultRetcodeDescription());
}

//+------------------------------------------------------------------+
//| Risk-based position size from stop distance                      |
//+------------------------------------------------------------------+
double CalcLots(double sl_dist)
{
   double tick_value = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tick_size  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tick_value <= 0 || tick_size <= 0 || sl_dist <= 0)
      return 0;

   double loss_per_lot = sl_dist / tick_size * tick_value;
   if(loss_per_lot <= 0)
      return 0;

   double risk_amount = AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPercent / 100.0;
   double lots = risk_amount / loss_per_lot;

   double min_lot  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_lot  = MathMin(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX), InpMaxLots);
   double lot_step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(lot_step > 0)
      lots = MathFloor(lots / lot_step) * lot_step;
   if(lots < min_lot)
      return 0; // refuse to oversize risk just to meet the minimum
   return MathMin(lots, max_lot);
}

//+------------------------------------------------------------------+
void UpdateComment(double score, bool tradable)
{
   string src = g_signal_fresh
                ? "dashboard (" + TimeToString(g_signal_time, TIME_MINUTES) + ")"
                : (InpAllowThesisOnly ? "THESIS ONLY (API unreachable)" : "NO SIGNAL — paused");
   long dir = OpenDirection();
   Comment(StringFormat(
      "FundamentalSentimentEA  [%s]\n"
      "Signal source: %s\n"
      "Dashboard: combined %.2f | fundamentals %.2f | sentiment %.2f\n"
      "Thesis bias: %.2f   (weights: signal %.1f / thesis %.1f)\n"
      "Blended score: %s%.2f   (entry > %.2f, exit < %.2f)\n"
      "Position: %s",
      g_pair, src,
      g_signal_combined, g_signal_fund, g_signal_sent,
      InpThesisBias, InpSignalWeight, InpThesisWeight,
      (tradable ? (score >= 0 ? "+" : "") : "n/a "), (tradable ? score : 0.0),
      InpEntryThreshold, InpExitThreshold,
      dir > 0 ? "LONG" : dir < 0 ? "SHORT" : "flat"));
}
//+------------------------------------------------------------------+
