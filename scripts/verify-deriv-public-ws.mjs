#!/usr/bin/env node
/**
 * Quick check: Deriv public options WebSocket returns active_symbols, ticks, history.
 * Run: node scripts/verify-deriv-public-ws.mjs
 */
const url = 'wss://api.derivws.com/trading/v1/options/ws/public';
const ws = new WebSocket(url);

const got = { active_symbols: false, tick: false, history: false, error: false };

ws.addEventListener('open', () => {
  console.log('connected', url);
  ws.send(JSON.stringify({ active_symbols: 'brief', req_id: 1 }));
  ws.send(JSON.stringify({ ticks: '1HZ100V', subscribe: 1, req_id: 2 }));
  ws.send(
    JSON.stringify({
      ticks_history: '1HZ100V',
      adjust_start_time: 1,
      count: 10,
      end: 'latest',
      style: 'ticks',
      req_id: 3,
    }),
  );
});

ws.addEventListener('message', (ev) => {
  const d = JSON.parse(ev.data);
  if (d.error) {
    got.error = true;
    console.error('error', d.error.code, d.error.message, 'req', d.echo_req?.req_id);
    return;
  }
  if (d.msg_type === 'active_symbols') {
    got.active_symbols = true;
    const n = Array.isArray(d.active_symbols) ? d.active_symbols.length : 0;
    console.log('active_symbols:', n, 'first underlying:', d.active_symbols?.[0]?.underlying_symbol);
  }
  if (d.msg_type === 'tick') {
    got.tick = true;
    console.log('tick', d.tick?.symbol, d.tick?.quote);
  }
  if (d.msg_type === 'history') {
    got.history = true;
    console.log('history prices:', d.history?.prices?.length);
  }
});

ws.addEventListener('error', (e) => console.error('socket error', e?.message || e));

setTimeout(() => {
  ws.close();
  console.log('\nSummary:', got);
  const ok = got.active_symbols && got.tick && got.history && !got.error;
  process.exit(ok ? 0 : 1);
}, 12000);
