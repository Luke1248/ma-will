"""
Forex Trading Dashboard
A paper-trading dashboard for USDTRY, USDCNH, and USDINR with trade
execution, sentiment analysis of market news, and fundamental analysis
of the underlying economies.

This is a SIMULATOR for education/practice. No real money is traded and
nothing here is financial advice.
"""

from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import math
import random
import re
import threading
import time

try:
    import requests
except ImportError:  # pragma: no cover - requests is in requirements.txt
    requests = None

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forex_trading.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

PAIRS = ['USDTRY', 'USDCNH', 'USDINR']
COUNTER_CURRENCY = {'USDTRY': 'TRY', 'USDCNH': 'CNH', 'USDINR': 'INR'}
STARTING_BALANCE = 100_000.0
LEVERAGE = 20
MIN_UNITS = 1_000
MAX_UNITS = 1_000_000

# Fallback mid-rates used when the live rates API is unreachable.
FALLBACK_RATES = {'USDTRY': 41.80, 'USDCNH': 7.12, 'USDINR': 85.60}
# Per-tick volatility (fraction of price) for the simulated random walk.
TICK_VOLATILITY = {'USDTRY': 0.0006, 'USDCNH': 0.0002, 'USDINR': 0.0002}
# The live API quotes onshore CNY; we use it as a proxy for offshore CNH.
LIVE_SYMBOL = {'USDTRY': 'TRY', 'USDCNH': 'CNY', 'USDINR': 'INR'}

LIVE_RATES_URL = 'https://open.er-api.com/v6/latest/USD'
LIVE_REFRESH_SECONDS = 60
MAX_HISTORY_POINTS = 500


# ============== DATABASE MODELS ==============

class Account(db.Model):
    """Single-row paper trading account."""
    id = db.Column(db.Integer, primary_key=True)
    balance = db.Column(db.Float, default=STARTING_BALANCE)


class Trade(db.Model):
    """A paper trade. Units are denominated in USD (the base currency)."""
    id = db.Column(db.Integer, primary_key=True)
    pair = db.Column(db.String(10), nullable=False)
    side = db.Column(db.String(4), nullable=False)  # buy, sell
    units = db.Column(db.Float, nullable=False)
    entry_rate = db.Column(db.Float, nullable=False)
    exit_rate = db.Column(db.Float)
    stop_loss = db.Column(db.Float)
    take_profit = db.Column(db.Float)
    status = db.Column(db.String(10), default='open')  # open, closed
    close_reason = db.Column(db.String(20))  # manual, stop_loss, take_profit
    pnl = db.Column(db.Float)
    opened_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'pair': self.pair,
            'side': self.side,
            'units': self.units,
            'entry_rate': self.entry_rate,
            'exit_rate': self.exit_rate,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'status': self.status,
            'close_reason': self.close_reason,
            'pnl': self.pnl,
            'opened_at': self.opened_at.isoformat() if self.opened_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
        }


class SentimentEntry(db.Model):
    """A scored piece of market news/commentary."""
    id = db.Column(db.Integer, primary_key=True)
    pair = db.Column(db.String(10), nullable=False)
    subject_currency = db.Column(db.String(5), nullable=False)
    source = db.Column(db.String(120))
    text = db.Column(db.Text, nullable=False)
    raw_score = db.Column(db.Float, nullable=False)   # sentiment toward subject currency
    pair_score = db.Column(db.Float, nullable=False)  # implied direction for the pair
    label = db.Column(db.String(10), nullable=False)  # bullish, bearish, neutral
    matched_terms = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'pair': self.pair,
            'subject_currency': self.subject_currency,
            'source': self.source,
            'text': self.text,
            'raw_score': self.raw_score,
            'pair_score': self.pair_score,
            'label': self.label,
            'matched_terms': self.matched_terms.split('|') if self.matched_terms else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Fundamental(db.Model):
    """Macro indicators for one currency's economy."""
    id = db.Column(db.Integer, primary_key=True)
    currency = db.Column(db.String(5), unique=True, nullable=False)
    interest_rate = db.Column(db.Float)        # policy rate, %
    inflation = db.Column(db.Float)            # CPI YoY, %
    gdp_growth = db.Column(db.Float)           # real GDP YoY, %
    unemployment = db.Column(db.Float)         # %
    current_account_gdp = db.Column(db.Float)  # % of GDP
    govt_debt_gdp = db.Column(db.Float)        # % of GDP
    fx_reserves_bn = db.Column(db.Float)       # USD billions
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'currency': self.currency,
            'interest_rate': self.interest_rate,
            'inflation': self.inflation,
            'gdp_growth': self.gdp_growth,
            'unemployment': self.unemployment,
            'current_account_gdp': self.current_account_gdp,
            'govt_debt_gdp': self.govt_debt_gdp,
            'fx_reserves_bn': self.fx_reserves_bn,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


DEFAULT_FUNDAMENTALS = {
    'USD': dict(interest_rate=4.00, inflation=2.7, gdp_growth=2.0, unemployment=4.2,
                current_account_gdp=-3.0, govt_debt_gdp=123.0, fx_reserves_bn=240.0),
    'TRY': dict(interest_rate=36.00, inflation=30.0, gdp_growth=3.2, unemployment=9.0,
                current_account_gdp=-1.5, govt_debt_gdp=26.0, fx_reserves_bn=155.0),
    'CNH': dict(interest_rate=3.00, inflation=0.7, gdp_growth=4.7, unemployment=5.1,
                current_account_gdp=1.5, govt_debt_gdp=90.0, fx_reserves_bn=3300.0),
    'INR': dict(interest_rate=5.50, inflation=4.0, gdp_growth=6.5, unemployment=7.5,
                current_account_gdp=-1.2, govt_debt_gdp=82.0, fx_reserves_bn=650.0),
}


# ============== RATES ENGINE ==============

class RatesEngine:
    """Serves rates anchored to a live API when reachable, with a small
    simulated random walk layered on top for tick-by-tick movement."""

    def __init__(self):
        self.lock = threading.Lock()
        self.base = dict(FALLBACK_RATES)
        self.noise = {p: 0.0 for p in PAIRS}
        self.history = {p: [] for p in PAIRS}
        self.last_live_fetch = 0.0
        self.live = False
        self._seed_history()

    def _seed_history(self):
        now = time.time()
        for pair in PAIRS:
            rate = self.base[pair]
            points = []
            for i in range(120, 0, -1):
                rate *= 1 + random.gauss(0, TICK_VOLATILITY[pair])
                points.append({'t': now - i * 5, 'rate': round(rate, 5)})
            self.history[pair] = points
            self.noise[pair] = points[-1]['rate'] - self.base[pair]

    def _refresh_live(self):
        if requests is None or time.time() - self.last_live_fetch < LIVE_REFRESH_SECONDS:
            return
        self.last_live_fetch = time.time()
        try:
            resp = requests.get(LIVE_RATES_URL, timeout=4)
            data = resp.json()
            rates = data.get('rates', {})
            updated = False
            for pair in PAIRS:
                value = rates.get(LIVE_SYMBOL[pair])
                if value:
                    self.base[pair] = float(value)
                    updated = True
            self.live = updated
        except Exception:
            self.live = False

    def tick(self):
        """Advance the walk one step and return current rates."""
        with self.lock:
            self._refresh_live()
            now = time.time()
            out = {}
            for pair in PAIRS:
                base = self.base[pair]
                self.noise[pair] += base * random.gauss(0, TICK_VOLATILITY[pair])
                # mean-revert noise so the simulated price stays near the anchor
                self.noise[pair] *= 0.98
                cap = base * 0.01
                self.noise[pair] = max(-cap, min(cap, self.noise[pair]))
                rate = round(base + self.noise[pair], 5)
                out[pair] = rate
                hist = self.history[pair]
                if not hist or now - hist[-1]['t'] >= 1:
                    hist.append({'t': now, 'rate': rate})
                    if len(hist) > MAX_HISTORY_POINTS:
                        del hist[:len(hist) - MAX_HISTORY_POINTS]
            return out

    def snapshot(self):
        rates = self.tick()
        spreads = {p: round(rates[p] * 0.0004, 5) for p in PAIRS}
        result = {}
        for pair in PAIRS:
            hist = self.history[pair]
            first = hist[0]['rate'] if hist else rates[pair]
            change = (rates[pair] - first) / first * 100 if first else 0
            result[pair] = {
                'mid': rates[pair],
                'bid': round(rates[pair] - spreads[pair] / 2, 5),
                'ask': round(rates[pair] + spreads[pair] / 2, 5),
                'change_pct': round(change, 3),
                'history': hist[-180:],
            }
        return {'pairs': result, 'live': self.live,
                'note': 'CNH proxied by onshore CNY when live data is used.',
                'timestamp': datetime.utcnow().isoformat()}


rates_engine = RatesEngine()


# ============== SENTIMENT ANALYSIS ==============

# Phrases/words scored for sentiment TOWARD the subject currency.
# Positive => supportive of that currency strengthening.
SENTIMENT_PHRASES = {
    'rate hike': 2.0, 'raises rates': 2.0, 'raised rates': 2.0, 'hawkish': 2.0,
    'tightening': 1.5, 'rate cut': -2.0, 'cuts rates': -2.0, 'cut rates': -2.0,
    'dovish': -2.0, 'easing': -1.5, 'quantitative easing': -2.0,
    'inflation surge': -2.0, 'inflation rises': -1.5, 'inflation cools': 1.5,
    'inflation falls': 1.5, 'disinflation': 1.5, 'hyperinflation': -3.0,
    'current account surplus': 2.0, 'current account deficit': -1.5,
    'trade surplus': 1.5, 'trade deficit': -1.0,
    'capital inflows': 2.0, 'capital outflows': -2.0, 'capital flight': -3.0,
    'fx intervention': -1.0, 'currency intervention': -1.0,
    'devaluation': -3.0, 'devalues': -3.0, 'depreciation': -1.5,
    'appreciation': 1.5, 'record low': -2.0, 'record high': 1.5,
    'credit upgrade': 2.5, 'credit downgrade': -2.5, 'rating upgrade': 2.5,
    'rating downgrade': -2.5, 'default risk': -3.0, 'debt crisis': -3.0,
    'political instability': -2.0, 'political stability': 1.5,
    'sanctions': -2.0, 'tariffs': -1.0, 'trade war': -1.5, 'trade deal': 1.5,
    'strong growth': 2.0, 'growth slows': -1.5, 'recession': -2.5,
    'soft landing': 1.0, 'hard landing': -2.0, 'stimulus': 0.5,
    'reserves rise': 1.5, 'reserves fall': -1.5, 'foreign investment': 1.5,
}

SENTIMENT_WORDS = {
    'strengthens': 2.0, 'strengthen': 1.5, 'strong': 1.0, 'stronger': 1.5,
    'weakens': -2.0, 'weaken': -1.5, 'weak': -1.0, 'weaker': -1.5,
    'rally': 1.5, 'rallies': 1.5, 'surge': 1.0, 'soars': 1.5, 'gains': 1.0,
    'plunge': -2.0, 'plunges': -2.0, 'tumbles': -2.0, 'slides': -1.5,
    'slumps': -1.5, 'falls': -1.0, 'drops': -1.0, 'crashes': -2.5,
    'crisis': -2.0, 'turmoil': -2.0, 'volatile': -0.5, 'uncertainty': -1.0,
    'stable': 1.0, 'stability': 1.0, 'confidence': 1.5, 'optimism': 1.5,
    'pessimism': -1.5, 'fears': -1.0, 'risk-off': -1.0, 'risk-on': 1.0,
    'bullish': 1.5, 'bearish': -1.5, 'upbeat': 1.0, 'downbeat': -1.0,
    'growth': 0.5, 'contraction': -1.5, 'expansion': 1.0, 'deficit': -0.5,
    'surplus': 0.5, 'inflows': 1.0, 'outflows': -1.0, 'upgrade': 1.5,
    'downgrade': -1.5, 'recovery': 1.5, 'rebound': 1.0, 'collapse': -2.5,
}


def analyze_sentiment(text, subject_currency, pair):
    """Score text for sentiment toward subject_currency, then translate
    that into a direction for the pair (positive = pair likely rises,
    i.e. USD strengthens vs the counter currency)."""
    lower = text.lower()
    score = 0.0
    matched = []

    for phrase, weight in SENTIMENT_PHRASES.items():
        count = lower.count(phrase)
        if count:
            score += weight * count
            matched.append(f"{phrase} ({'+' if weight > 0 else ''}{weight})")

    words = re.findall(r"[a-z\-]+", lower)
    for word in words:
        weight = SENTIMENT_WORDS.get(word)
        if weight:
            score += weight
            matched.append(f"{word} ({'+' if weight > 0 else ''}{weight})")

    # Normalize to [-1, 1]; tanh keeps long rants from saturating linearly.
    raw_score = math.tanh(score / 5.0)

    # Pair direction: USDXXX rises when USD is strong or counter ccy is weak.
    pair_score = raw_score if subject_currency == 'USD' else -raw_score

    if pair_score > 0.15:
        label = 'bullish'
    elif pair_score < -0.15:
        label = 'bearish'
    else:
        label = 'neutral'

    return round(raw_score, 4), round(pair_score, 4), label, matched


# ============== TRADING HELPERS ==============

def get_account():
    account = Account.query.first()
    if not account:
        account = Account(balance=STARTING_BALANCE)
        db.session.add(account)
        db.session.commit()
    return account


def trade_pnl(trade, current_rate):
    """Unrealized P&L in USD for a trade on a USD-base pair.
    P&L accrues in the quote currency, so convert back at current rate."""
    if trade.side == 'buy':
        quote_pnl = trade.units * (current_rate - trade.entry_rate)
    else:
        quote_pnl = trade.units * (trade.entry_rate - current_rate)
    return quote_pnl / current_rate if current_rate else 0.0


def close_trade(trade, rate, reason):
    trade.exit_rate = rate
    trade.pnl = round(trade_pnl(trade, rate), 2)
    trade.status = 'closed'
    trade.close_reason = reason
    trade.closed_at = datetime.utcnow()
    account = get_account()
    account.balance = round(account.balance + trade.pnl, 2)


def check_stops(rates):
    """Auto-close any open trade whose stop loss / take profit was hit."""
    triggered = []
    for trade in Trade.query.filter_by(status='open').all():
        info = rates['pairs'].get(trade.pair)
        if not info:
            continue
        # Exits happen on the side you'd actually trade out at.
        exit_rate = info['bid'] if trade.side == 'buy' else info['ask']
        if trade.side == 'buy':
            if trade.stop_loss and exit_rate <= trade.stop_loss:
                close_trade(trade, exit_rate, 'stop_loss'); triggered.append(trade)
            elif trade.take_profit and exit_rate >= trade.take_profit:
                close_trade(trade, exit_rate, 'take_profit'); triggered.append(trade)
        else:
            if trade.stop_loss and exit_rate >= trade.stop_loss:
                close_trade(trade, exit_rate, 'stop_loss'); triggered.append(trade)
            elif trade.take_profit and exit_rate <= trade.take_profit:
                close_trade(trade, exit_rate, 'take_profit'); triggered.append(trade)
    if triggered:
        db.session.commit()
    return triggered


# ============== ROUTES ==============

@app.route('/')
def index():
    return render_template('forex.html')


@app.route('/api/rates', methods=['GET'])
def api_rates():
    rates = rates_engine.snapshot()
    check_stops(rates)
    return jsonify(rates)


@app.route('/api/account', methods=['GET'])
def api_account():
    rates = rates_engine.snapshot()
    check_stops(rates)
    account = get_account()
    open_trades = Trade.query.filter_by(status='open').all()
    open_pnl = sum(trade_pnl(t, rates['pairs'][t.pair]['mid']) for t in open_trades)
    margin_used = sum(t.units / LEVERAGE for t in open_trades)
    equity = account.balance + open_pnl
    return jsonify({
        'balance': round(account.balance, 2),
        'equity': round(equity, 2),
        'open_pnl': round(open_pnl, 2),
        'margin_used': round(margin_used, 2),
        'free_margin': round(equity - margin_used, 2),
        'leverage': LEVERAGE,
        'open_positions': len(open_trades),
    })


@app.route('/api/account/reset', methods=['POST'])
def api_account_reset():
    Trade.query.delete()
    account = get_account()
    account.balance = STARTING_BALANCE
    db.session.commit()
    return jsonify({'balance': account.balance})


@app.route('/api/trades', methods=['GET'])
def api_open_trades():
    rates = rates_engine.snapshot()
    check_stops(rates)
    result = []
    for trade in Trade.query.filter_by(status='open').order_by(Trade.opened_at.desc()).all():
        d = trade.to_dict()
        mid = rates['pairs'][trade.pair]['mid']
        d['current_rate'] = mid
        d['unrealized_pnl'] = round(trade_pnl(trade, mid), 2)
        result.append(d)
    return jsonify(result)


@app.route('/api/trades', methods=['POST'])
def api_open_trade():
    data = request.json or {}
    pair = data.get('pair')
    side = data.get('side')
    try:
        units = float(data.get('units', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid units'}), 400

    if pair not in PAIRS:
        return jsonify({'error': f'Pair must be one of {PAIRS}'}), 400
    if side not in ('buy', 'sell'):
        return jsonify({'error': 'Side must be buy or sell'}), 400
    if not (MIN_UNITS <= units <= MAX_UNITS):
        return jsonify({'error': f'Units must be between {MIN_UNITS:,} and {MAX_UNITS:,}'}), 400

    stop_loss = data.get('stop_loss')
    take_profit = data.get('take_profit')
    try:
        stop_loss = float(stop_loss) if stop_loss not in (None, '') else None
        take_profit = float(take_profit) if take_profit not in (None, '') else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid stop loss / take profit'}), 400

    rates = rates_engine.snapshot()
    info = rates['pairs'][pair]
    entry = info['ask'] if side == 'buy' else info['bid']

    if side == 'buy':
        if stop_loss and stop_loss >= entry:
            return jsonify({'error': 'Stop loss must be below entry for a buy'}), 400
        if take_profit and take_profit <= entry:
            return jsonify({'error': 'Take profit must be above entry for a buy'}), 400
    else:
        if stop_loss and stop_loss <= entry:
            return jsonify({'error': 'Stop loss must be above entry for a sell'}), 400
        if take_profit and take_profit >= entry:
            return jsonify({'error': 'Take profit must be below entry for a sell'}), 400

    account = get_account()
    open_trades = Trade.query.filter_by(status='open').all()
    open_pnl = sum(trade_pnl(t, rates['pairs'][t.pair]['mid']) for t in open_trades)
    margin_used = sum(t.units / LEVERAGE for t in open_trades)
    free_margin = account.balance + open_pnl - margin_used
    required = units / LEVERAGE
    if required > free_margin:
        return jsonify({'error': f'Insufficient free margin: need ${required:,.2f}, '
                                 f'have ${free_margin:,.2f}'}), 400

    trade = Trade(pair=pair, side=side, units=units, entry_rate=entry,
                  stop_loss=stop_loss, take_profit=take_profit)
    db.session.add(trade)
    db.session.commit()
    return jsonify(trade.to_dict()), 201


@app.route('/api/trades/<int:id>/close', methods=['POST'])
def api_close_trade(id):
    trade = Trade.query.get_or_404(id)
    if trade.status != 'open':
        return jsonify({'error': 'Trade is already closed'}), 400
    rates = rates_engine.snapshot()
    info = rates['pairs'][trade.pair]
    exit_rate = info['bid'] if trade.side == 'buy' else info['ask']
    close_trade(trade, exit_rate, 'manual')
    db.session.commit()
    return jsonify(trade.to_dict())


@app.route('/api/trades/history', methods=['GET'])
def api_trade_history():
    trades = Trade.query.filter_by(status='closed').order_by(Trade.closed_at.desc()).limit(100).all()
    closed = [t.to_dict() for t in trades]
    total_pnl = sum(t.pnl or 0 for t in trades)
    wins = sum(1 for t in trades if (t.pnl or 0) > 0)
    return jsonify({
        'trades': closed,
        'total_pnl': round(total_pnl, 2),
        'count': len(closed),
        'win_rate': round(wins / len(closed) * 100, 1) if closed else 0,
    })


# ----- Sentiment Routes -----

@app.route('/api/sentiment', methods=['GET'])
def api_sentiment_list():
    entries = SentimentEntry.query.order_by(SentimentEntry.created_at.desc()).limit(100).all()
    aggregates = {}
    for pair in PAIRS:
        pair_entries = [e for e in entries if e.pair == pair]
        if pair_entries:
            # Recent entries count more: weight decays with position.
            weights = [0.85 ** i for i in range(len(pair_entries))]
            total = sum(w * e.pair_score for w, e in zip(weights, pair_entries)) / sum(weights)
        else:
            total = 0.0
        aggregates[pair] = {
            'score': round(total, 4),
            'count': len(pair_entries),
            'label': 'bullish' if total > 0.15 else 'bearish' if total < -0.15 else 'neutral',
        }
    return jsonify({'entries': [e.to_dict() for e in entries], 'aggregates': aggregates})


@app.route('/api/sentiment/analyze', methods=['POST'])
def api_sentiment_analyze():
    data = request.json or {}
    text = (data.get('text') or '').strip()
    pair = data.get('pair')
    subject = data.get('subject_currency', 'USD')
    source = (data.get('source') or '').strip() or None

    if not text:
        return jsonify({'error': 'Text is required'}), 400
    if pair not in PAIRS:
        return jsonify({'error': f'Pair must be one of {PAIRS}'}), 400
    valid_subjects = ('USD', COUNTER_CURRENCY[pair])
    if subject not in valid_subjects:
        return jsonify({'error': f'Subject currency must be one of {valid_subjects}'}), 400

    raw, pair_score, label, matched = analyze_sentiment(text, subject, pair)
    entry = SentimentEntry(pair=pair, subject_currency=subject, source=source,
                           text=text, raw_score=raw, pair_score=pair_score,
                           label=label, matched_terms='|'.join(matched))
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@app.route('/api/sentiment/<int:id>', methods=['DELETE'])
def api_sentiment_delete(id):
    entry = SentimentEntry.query.get_or_404(id)
    db.session.delete(entry)
    db.session.commit()
    return '', 204


# ----- Fundamental Analysis Routes -----

def seed_fundamentals():
    for currency, values in DEFAULT_FUNDAMENTALS.items():
        if not Fundamental.query.filter_by(currency=currency).first():
            db.session.add(Fundamental(currency=currency, **values))
    db.session.commit()


@app.route('/api/fundamentals', methods=['GET'])
def api_fundamentals():
    return jsonify({f.currency: f.to_dict() for f in Fundamental.query.all()})


@app.route('/api/fundamentals/<currency>', methods=['PUT'])
def api_update_fundamental(currency):
    currency = currency.upper()
    fundamental = Fundamental.query.filter_by(currency=currency).first_or_404()
    data = request.json or {}
    fields = ['interest_rate', 'inflation', 'gdp_growth', 'unemployment',
              'current_account_gdp', 'govt_debt_gdp', 'fx_reserves_bn']
    for field in fields:
        if field in data:
            try:
                setattr(fundamental, field, float(data[field]))
            except (TypeError, ValueError):
                return jsonify({'error': f'Invalid value for {field}'}), 400
    db.session.commit()
    return jsonify(fundamental.to_dict())


def fundamental_pair_analysis(pair):
    """Heuristic fundamental score for a USD-base pair.
    Positive score => fundamentals favor USD (pair rises);
    negative => they favor the counter currency (pair falls)."""
    counter = COUNTER_CURRENCY[pair]
    usd = Fundamental.query.filter_by(currency='USD').first()
    ccy = Fundamental.query.filter_by(currency=counter).first()
    if not usd or not ccy:
        return None

    components = []

    def add(name, value, weight, detail):
        # squash each component to [-1, 1] before weighting
        components.append({
            'name': name,
            'value': round(math.tanh(value), 3),
            'weight': weight,
            'detail': detail,
        })

    real_usd = (usd.interest_rate or 0) - (usd.inflation or 0)
    real_ccy = (ccy.interest_rate or 0) - (ccy.inflation or 0)
    add('Real interest rate differential', (real_usd - real_ccy) / 4.0, 2.0,
        f'USD real rate {real_usd:+.1f}% vs {counter} {real_ccy:+.1f}%. Higher real '
        f'yield tends to attract capital toward that currency.')

    add('Inflation differential', ((ccy.inflation or 0) - (usd.inflation or 0)) / 10.0, 1.5,
        f'{counter} inflation {ccy.inflation:.1f}% vs USD {usd.inflation:.1f}%. Persistent '
        f'higher inflation erodes the nominal value of the counter currency.')

    add('Growth differential', ((usd.gdp_growth or 0) - (ccy.gdp_growth or 0)) / 3.0, 1.0,
        f'USD GDP growth {usd.gdp_growth:.1f}% vs {counter} {ccy.gdp_growth:.1f}%. Stronger '
        f'growth supports a currency via investment flows.')

    add('External balance', ((usd.current_account_gdp or 0) - (ccy.current_account_gdp or 0)) / 4.0, 1.0,
        f'USD current account {usd.current_account_gdp:+.1f}% of GDP vs {counter} '
        f'{ccy.current_account_gdp:+.1f}%. Surpluses provide structural demand for a currency.')

    add('Government debt burden', ((ccy.govt_debt_gdp or 0) - (usd.govt_debt_gdp or 0)) / 80.0, 0.5,
        f'{counter} debt {ccy.govt_debt_gdp:.0f}% of GDP vs USD {usd.govt_debt_gdp:.0f}%.')

    weight_sum = sum(c['weight'] for c in components)
    score = sum(c['value'] * c['weight'] for c in components) / weight_sum
    score = round(score * 100, 1)  # -100 .. +100

    if score > 30:
        outlook, bias = f'Strongly favors USD over {counter}', 'bullish'
    elif score > 10:
        outlook, bias = f'Moderately favors USD over {counter}', 'bullish'
    elif score < -30:
        outlook, bias = f'Strongly favors {counter} over USD', 'bearish'
    elif score < -10:
        outlook, bias = f'Moderately favors {counter} over USD', 'bearish'
    else:
        outlook, bias = 'Broadly balanced', 'neutral'

    return {'pair': pair, 'score': score, 'bias': bias, 'outlook': outlook,
            'components': components}


@app.route('/api/fundamentals/analysis', methods=['GET'])
def api_fundamental_analysis():
    return jsonify({pair: fundamental_pair_analysis(pair) for pair in PAIRS})


# ----- Combined Signal -----

def compute_signals():
    """Blend sentiment and fundamentals into one directional signal per pair."""
    sentiment = {}
    entries = SentimentEntry.query.order_by(SentimentEntry.created_at.desc()).limit(100).all()
    for pair in PAIRS:
        pair_entries = [e for e in entries if e.pair == pair]
        if pair_entries:
            weights = [0.85 ** i for i in range(len(pair_entries))]
            sentiment[pair] = sum(w * e.pair_score for w, e in zip(weights, pair_entries)) / sum(weights)
        else:
            sentiment[pair] = 0.0

    result = {}
    for pair in PAIRS:
        fund = fundamental_pair_analysis(pair)
        fund_score = (fund['score'] / 100.0) if fund else 0.0
        sent_score = sentiment[pair]
        combined = 0.6 * fund_score + 0.4 * sent_score
        result[pair] = {
            'sentiment': round(sent_score, 3),
            'fundamental': round(fund_score, 3),
            'combined': round(combined, 3),
            'bias': 'bullish' if combined > 0.1 else 'bearish' if combined < -0.1 else 'neutral',
        }
    return result


@app.route('/api/signal', methods=['GET'])
def api_signal():
    return jsonify(compute_signals())


@app.route('/api/signal/plain', methods=['GET'])
def api_signal_plain():
    """CSV signal feed for the MetaTrader EA: one line per pair as
    PAIR,combined,fundamental,sentiment,bias"""
    signals = compute_signals()
    lines = [f"{pair},{v['combined']},{v['fundamental']},{v['sentiment']},{v['bias']}"
             for pair, v in signals.items()]
    return '\n'.join(lines) + '\n', 200, {'Content-Type': 'text/plain; charset=utf-8'}


with app.app_context():
    db.create_all()
    seed_fundamentals()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
