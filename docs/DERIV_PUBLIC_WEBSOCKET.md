# Deriv public WebSocket — verification notes

Verified against `wss://api.derivws.com/trading/v1/options/ws/public` (Node.js built-in `WebSocket`, 2026).

## Does it return data?

**Yes**, once the outbound requests validate.

| Request | Result |
|--------|--------|
| `active_symbols: "brief"` | **OK** — array of symbol objects (e.g. `underlying_symbol`, `underlying_symbol_name`, `market`). |
| `ticks` + `subscribe: 1` for `1HZ100V` | **OK** — repeated `msg_type: "tick"` messages with `tick.quote`, `tick.symbol`, `tick.epoch`. |
| `ticks_history` | **OK** — `msg_type: "history"` with `history.prices` and `history.times` arrays. |

## Common mistake in example payloads

Sending **`product_type`** together with **`active_symbols: "brief"`** is rejected:

```json
{"code":"InputValidationFailed","message":"Input validation failed: Properties not allowed: product_type."}
```

**Fix:** omit `product_type` for this call, or follow the exact schema allowed for your `active_symbols` mode in the official Deriv docs.

## Response shape vs. sample `console.log` checks

- **Ticks:** `msg_type === "tick"` and live quote at **`data.tick.quote`** — matches the usual pattern.
- **History:** responses use **`msg_type === "history"`** (not `"ticks_history"`). History series is under **`data.history`** with **`prices`** and **`times`** arrays.
- **Active symbols (brief):** each entry uses fields like **`underlying_symbol`**, not necessarily `symbol`. Log one element’s keys before assuming field names.

## Minimal working sequence (reference)

```javascript
const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    active_symbols: 'brief',
    req_id: 1,
  }));

  ws.send(JSON.stringify({
    ticks: '1HZ100V',
    subscribe: 1,
    req_id: 2,
  }));

  ws.send(JSON.stringify({
    ticks_history: '1HZ100V',
    adjust_start_time: 1,
    count: 100,
    end: 'latest',
    style: 'ticks',
    req_id: 3,
  }));
});

ws.addEventListener('message', (ev) => {
  const data = JSON.parse(ev.data);
  if (data.error) {
    console.error(data.error);
    return;
  }
  if (data.msg_type === 'active_symbols') {
    console.log('symbols:', data.active_symbols?.length);
  }
  if (data.msg_type === 'tick') {
    console.log('quote:', data.tick?.quote);
  }
  if (data.msg_type === 'history') {
    console.log('history points:', data.history?.prices?.length);
  }
});
```

Always branch on **`data.error`** first; the server returns structured errors for invalid requests.

## Official references

- [Deriv API documentation](https://developers.deriv.com/docs/)
- [WebSocket playground](https://developers.deriv.com/playground) (useful to compare request/response shapes)
