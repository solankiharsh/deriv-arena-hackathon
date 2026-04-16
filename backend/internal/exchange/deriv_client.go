package exchange

import (
	"context"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	mrand "math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"derivarena/internal/derivcontract"
)

// DerivClient executes trades on Deriv's synthetic markets via API V2.
// Supports demo and real accounts, OAuth PKCE auth, OTP-authenticated WebSocket.
//
// Two modes:
//   - demo: Uses demo accounts created via /trading/v1/options/accounts
//   - real: Uses real accounts (requires OAuth token with real account access)
//
// Trade flow:
//  1. OAuth PKCE (external) → access_token
//  2. POST /trading/v1/options/accounts/{accountId}/otp → WebSocket URL
//  3. Connect to WS, send proposal → get proposal ID
//  4. Send buy with proposal ID → get contract_id
//  5. Subscribe to proposal_open_contract for live updates
//  6. Optionally sell before expiry
type DerivClient struct {
	log            *zap.Logger
	baseURL        string // REST base: https://api.derivws.com
	accessToken    string // OAuth access token (from PKCE flow)
	accountID      string // Deriv account ID (e.g., "DOT90004580")
	isDemo         bool   // true = demo mode
	commissionRate decimal.Decimal

	mu         sync.RWMutex
	wsConn     *websocket.Conn
	wsURL      string
	lastPrices map[string]decimal.Decimal // Deriv symbol → last price
	reqID      int

	// Response channels keyed by req_id
	responseCh map[int]chan map[string]interface{}
	chMu       sync.Mutex
}

type DerivConfig struct {
	BaseURL     string // https://api.derivws.com
	AccessToken string // OAuth access token (from PKCE flow)
	AccountID   string // Deriv account ID
	IsDemo      bool   // true = demo mode, false = real
}

func NewDerivClient(log *zap.Logger, cfg DerivConfig, commissionRate decimal.Decimal) (*DerivClient, error) {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.derivws.com"
	}
	if cfg.AccountID == "" {
		return nil, fmt.Errorf("deriv client: account_id required")
	}
	if cfg.AccessToken == "" {
		return nil, fmt.Errorf("deriv client: access_token required (from OAuth PKCE flow)")
	}

	client := &DerivClient{
		log:            log,
		baseURL:        cfg.BaseURL,
		accessToken:    cfg.AccessToken,
		accountID:      cfg.AccountID,
		isDemo:         cfg.IsDemo,
		commissionRate: commissionRate,
		lastPrices:     make(map[string]decimal.Decimal),
		responseCh:     make(map[int]chan map[string]interface{}),
	}

	if err := client.connect(); err != nil {
		return nil, fmt.Errorf("deriv client: connect: %w", err)
	}

	go client.readLoop()

	return client, nil
}

// connect obtains OTP and establishes WebSocket connection.
func (c *DerivClient) connect() error {
	otpURL := fmt.Sprintf("%s/trading/v1/options/accounts/%s/otp", c.baseURL, c.accountID)

	req, err := http.NewRequest(http.MethodPost, otpURL, nil)
	if err != nil {
		return fmt.Errorf("create OTP request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("POST OTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OTP request failed: status %d", resp.StatusCode)
	}

	var otpResp struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&otpResp); err != nil {
		return fmt.Errorf("decode OTP response: %w", err)
	}

	c.wsURL = otpResp.Data.URL
	if c.wsURL == "" {
		return fmt.Errorf("empty WebSocket URL in OTP response")
	}

	dialer := websocket.Dialer{HandshakeTimeout: 20 * time.Second}
	ws, _, err := dialer.Dial(c.wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial WebSocket: %w", err)
	}

	c.mu.Lock()
	if c.wsConn != nil {
		_ = c.wsConn.Close()
	}
	c.wsConn = ws
	c.mu.Unlock()

	c.log.Info("Deriv WebSocket connected", zap.Bool("demo", c.isDemo))
	return nil
}

func (c *DerivClient) closeWS() {
	c.mu.Lock()
	if c.wsConn != nil {
		_ = c.wsConn.Close()
		c.wsConn = nil
	}
	c.mu.Unlock()
}

func (c *DerivClient) jitter(d time.Duration) time.Duration {
	if d <= 0 {
		return d
	}
	j := time.Duration(mrand.Int63n(int64(d / 5)))
	return d + j
}

// readLoop processes WebSocket messages until read error, then reconnects with backoff.
func (c *DerivClient) readLoop() {
	backoff := time.Second
	const maxBackoff = 30 * time.Second
	for {
		c.mu.RLock()
		conn := c.wsConn
		c.mu.RUnlock()
		if conn == nil {
			time.Sleep(c.jitter(backoff))
			if err := c.connect(); err != nil {
				c.log.Error("Deriv reconnect failed", zap.Error(err))
				if backoff < maxBackoff {
					backoff *= 2
				}
				time.Sleep(c.jitter(backoff))
			} else {
				backoff = time.Second
			}
			continue
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			c.log.Error("Deriv WS read error", zap.Error(err))
			c.closeWS()
			if backoff < maxBackoff {
				backoff *= 2
			}
			time.Sleep(c.jitter(backoff))
			if err := c.connect(); err != nil {
				c.log.Error("Deriv reconnect failed", zap.Error(err))
				time.Sleep(c.jitter(backoff))
			} else {
				backoff = time.Second
			}
			continue
		}
		backoff = time.Second

		var resp map[string]interface{}
		if err := json.Unmarshal(msg, &resp); err != nil {
			c.log.Warn("Deriv WS: failed to parse message", zap.Error(err))
			continue
		}

		if errObj, ok := resp["error"].(map[string]interface{}); ok {
			c.log.Error("Deriv API error", zap.Any("error", errObj))
		}

		if reqIDFloat, ok := resp["req_id"].(float64); ok {
			reqID := int(reqIDFloat)
			c.chMu.Lock()
			if ch, exists := c.responseCh[reqID]; exists {
				select {
				case ch <- resp:
				default:
					c.log.Warn("Response channel full", zap.Int("req_id", reqID))
				}
			}
			c.chMu.Unlock()
		}

		if tick, ok := resp["tick"].(map[string]interface{}); ok {
			if symbol, ok := tick["symbol"].(string); ok {
				if quote, ok := tick["quote"].(float64); ok {
					c.mu.Lock()
					c.lastPrices[symbol] = decimal.NewFromFloat(quote)
					c.mu.Unlock()
				}
			}
		}
	}
}

// sendRequest sends a WS message and waits for response (correlated by req_id).
func (c *DerivClient) sendRequest(ctx context.Context, payload map[string]interface{}, timeout time.Duration) (map[string]interface{}, error) {
	c.mu.Lock()
	c.reqID++
	reqID := c.reqID
	payload["req_id"] = reqID
	c.mu.Unlock()

	ch := make(chan map[string]interface{}, 1)
	c.chMu.Lock()
	c.responseCh[reqID] = ch
	c.chMu.Unlock()

	defer func() {
		c.chMu.Lock()
		delete(c.responseCh, reqID)
		close(ch)
		c.chMu.Unlock()
	}()

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	c.mu.RLock()
	conn := c.wsConn
	c.mu.RUnlock()
	if conn == nil {
		return nil, fmt.Errorf("deriv: websocket not connected")
	}
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return nil, fmt.Errorf("send WS message: %w", err)
	}

	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case resp := <-ch:
		if errObj, ok := resp["error"].(map[string]interface{}); ok {
			return nil, fmt.Errorf("deriv error: %v", errObj)
		}
		return resp, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-timer.C:
		return nil, fmt.Errorf("timeout waiting for response (req_id=%d)", reqID)
	}
}

// SubmitTrade executes a trade via Deriv's proposal → buy flow.
func (c *DerivClient) SubmitTrade(req *TradeRequest) (*TradeResponse, error) {
	if req.Params == nil {
		return nil, fmt.Errorf("deriv: Params required (contract_type, duration, duration_unit, symbol)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pp, err := derivcontract.NormalizeProposalParams(req.Pair, req.Value, req.Params)
	if err != nil {
		return nil, err
	}

	proposal := map[string]interface{}{
		"proposal":          1,
		"amount":            pp.Stake.InexactFloat64(),
		"basis":             "stake",
		"contract_type":     pp.ContractType,
		"currency":          "USD",
		"duration":          pp.Duration,
		"duration_unit":     pp.DurationUnit,
		"underlying_symbol": pp.Symbol,
	}
	if pp.GrowthRate != nil {
		proposal["growth_rate"] = *pp.GrowthRate
	}
	if pp.Multiplier != nil {
		proposal["multiplier"] = *pp.Multiplier
	}
	if pp.StopLoss != nil && pp.TakeProfit != nil {
		proposal["limit_order"] = map[string]float64{
			"stop_loss":   *pp.StopLoss,
			"take_profit": *pp.TakeProfit,
		}
	}

	propResp, err := c.sendRequest(ctx, proposal, 20*time.Second)
	if err != nil {
		return nil, fmt.Errorf("deriv: proposal: %w", err)
	}

	propData, ok := propResp["proposal"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("deriv: no proposal in response")
	}

	proposalID, ok := propData["id"].(string)
	if !ok || proposalID == "" {
		return nil, fmt.Errorf("deriv: no proposal ID")
	}

	askPrice, ok := propData["ask_price"].(float64)
	if !ok {
		return nil, fmt.Errorf("deriv: no ask_price in proposal")
	}

	buy := map[string]interface{}{
		"buy":   proposalID,
		"price": askPrice,
	}

	buyResp, err := c.sendRequest(ctx, buy, 20*time.Second)
	if err != nil {
		return nil, fmt.Errorf("deriv: buy: %w", err)
	}

	buyData, ok := buyResp["buy"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("deriv: no buy in response")
	}

	contractID, ok := buyData["contract_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("deriv: no contract_id in buy response")
	}

	buyPrice, ok := buyData["buy_price"].(float64)
	if !ok {
		buyPrice = askPrice
	}

	c.mu.Lock()
	c.lastPrices[pp.Symbol] = decimal.NewFromFloat(buyPrice)
	c.mu.Unlock()

	return &TradeResponse{
		FillID:   fmt.Sprintf("deriv_%d", int64(contractID)),
		Status:   StatusFilled,
		Price:    decimal.NewFromFloat(buyPrice),
		Qty:      decimal.NewFromInt(1),
		QuoteQty: decimal.NewFromFloat(buyPrice),
		Fee:      decimal.Zero,
		Pair:     req.Pair,
		Side:     req.Side,
	}, nil
}

// GetPrice returns the last known price for a symbol (pair mapped to Deriv symbol).
func (c *DerivClient) GetPrice(pair string) (decimal.Decimal, bool) {
	sym, err := derivcontract.PairToDeriv(pair)
	if err != nil {
		return decimal.Zero, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	price, ok := c.lastPrices[sym]
	return price, ok
}

// GetPrices returns all last known prices (Deriv symbol keys).
func (c *DerivClient) GetPrices() map[string]decimal.Decimal {
	c.mu.Lock()
	defer c.mu.Unlock()
	prices := make(map[string]decimal.Decimal, len(c.lastPrices))
	for k, v := range c.lastPrices {
		prices[k] = v
	}
	return prices
}

// GetBalance returns current balance from Deriv.
func (c *DerivClient) GetBalance() ([]BalanceEntry, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	balResp, err := c.sendRequest(ctx, map[string]interface{}{
		"balance": 1,
	}, 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("deriv: balance: %w", err)
	}

	balData, ok := balResp["balance"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("deriv: no balance in response")
	}

	balanceFloat, _ := balData["balance"].(float64)
	currency, _ := balData["currency"].(string)
	if currency == "" {
		currency = "USD"
	}

	balance := decimal.NewFromFloat(balanceFloat)
	return []BalanceEntry{
		{
			Asset:     currency,
			Available: balance,
			Reserved:  decimal.Zero,
			Total:     balance,
		},
	}, nil
}

// Close closes the WebSocket connection.
func (c *DerivClient) Close() error {
	c.closeWS()
	return nil
}

// GeneratePKCE generates code_verifier and code_challenge for OAuth PKCE flow.
func GeneratePKCE() (codeVerifier, codeChallenge string, err error) {
	bytes := make([]byte, 64)
	if _, err := crand.Read(bytes); err != nil {
		return "", "", fmt.Errorf("generate verifier: %w", err)
	}

	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
	verifier := make([]byte, 64)
	for i, b := range bytes {
		verifier[i] = charset[int(b)%len(charset)]
	}
	codeVerifier = string(verifier)

	hash := sha256.Sum256([]byte(codeVerifier))
	codeChallenge = base64.RawURLEncoding.EncodeToString(hash[:])

	return codeVerifier, codeChallenge, nil
}

// BuildAuthURL constructs the OAuth authorization URL for user redirect.
func BuildAuthURL(clientID, redirectURI, codeChallenge, state string, scope string) string {
	if scope == "" {
		scope = "trade"
	}

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", clientID)
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", scope)
	params.Set("state", state)
	params.Set("code_challenge", codeChallenge)
	params.Set("code_challenge_method", "S256")

	return "https://auth.deriv.com/oauth2/auth?" + params.Encode()
}

// ExchangeCodeForToken exchanges OAuth authorization code for access token.
func ExchangeCodeForToken(clientID, code, codeVerifier, redirectURI string) (accessToken string, err error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", clientID)
	data.Set("code", code)
	data.Set("code_verifier", codeVerifier)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest(http.MethodPost, "https://auth.deriv.com/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("POST token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token exchange failed: status %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}

	return tokenResp.AccessToken, nil
}

// CreateDemoAccount creates a demo account via Deriv API V2.
func CreateDemoAccount(accessToken string) (accountID string, err error) {
	data := map[string]interface{}{
		"currency":     "USD",
		"group":        "row",
		"account_type": "demo",
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("marshal account request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.derivws.com/trading/v1/options/accounts", strings.NewReader(string(jsonData)))
	if err != nil {
		return "", fmt.Errorf("create account request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("POST accounts: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("create account failed: status %d", resp.StatusCode)
	}

	var accountResp struct {
		Data []struct {
			AccountID string `json:"account_id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&accountResp); err != nil {
		return "", fmt.Errorf("decode account response: %w", err)
	}

	if len(accountResp.Data) == 0 {
		return "", fmt.Errorf("no account in response")
	}

	return accountResp.Data[0].AccountID, nil
}

// ResetDemoBalance resets demo account balance to initial $10,000.
func ResetDemoBalance(accessToken, accountID string) error {
	resetURL := fmt.Sprintf("https://api.derivws.com/trading/v1/options/accounts/%s/reset-demo-balance", accountID)

	req, err := http.NewRequest(http.MethodPost, resetURL, nil)
	if err != nil {
		return fmt.Errorf("create reset request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("POST reset: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("reset failed: status %d", resp.StatusCode)
	}

	return nil
}
