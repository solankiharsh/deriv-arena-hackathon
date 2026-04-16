package telegrambot

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"regexp"
	"time"

	"go.uber.org/zap"
)

// tokenStripper removes any leaked bot<id>:<token> substring before logging.
var tokenStripper = regexp.MustCompile(`bot[0-9]+:[A-Za-z0-9_-]{30,}`)

// scrub masks the bot token anywhere it might appear in a string.
func scrub(s string) string {
	return tokenStripper.ReplaceAllString(s, "bot***:***")
}

// Client is a thin wrapper around Telegram Bot API.
type Client struct {
	token      string // read once at construction; never logged
	httpClient *http.Client
	log        *zap.Logger
	dryRun     bool
}

// NewClient builds a client. Token is read via os.Getenv in the caller; we do
// not read it here to keep the package easy to unit-test.
func NewClient(token string, log *zap.Logger, dryRun bool) *Client {
	if log == nil {
		log = zap.NewNop()
	}
	return &Client{
		token: token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		log:    log,
		dryRun: dryRun,
	}
}

// tgResponse is the envelope returned by Telegram for every call.
type tgResponse struct {
	OK          bool            `json:"ok"`
	Result      json.RawMessage `json:"result,omitempty"`
	Description string          `json:"description,omitempty"`
	ErrorCode   int             `json:"error_code,omitempty"`
	Parameters  *struct {
		RetryAfter int `json:"retry_after,omitempty"`
	} `json:"parameters,omitempty"`
}

// tgMessage is the subset of the Message struct we care about.
type tgMessage struct {
	MessageID int64 `json:"message_id"`
}

// ErrDisabled signals the client is disabled (dry run or missing token).
var ErrDisabled = errors.New("telegram client disabled")

// ErrFatal signals a non-retryable failure (401, 403, etc). Broadcaster should
// stop attempting further sends.
var ErrFatal = errors.New("telegram fatal error")

// SendPhoto posts a photo by URL with caption + inline keyboard.
// Returns message_id on success.
func (c *Client) SendPhoto(ctx context.Context, chatID, photoURL, caption string, replyMarkup map[string]any) (int64, error) {
	body := map[string]any{
		"chat_id":    chatID,
		"photo":      photoURL,
		"caption":    caption,
		"parse_mode": "HTML",
	}
	if replyMarkup != nil {
		body["reply_markup"] = replyMarkup
	}
	return c.call(ctx, "sendPhoto", body)
}

// SendMessage posts a plain text message with inline keyboard.
func (c *Client) SendMessage(ctx context.Context, chatID, text string, replyMarkup map[string]any) (int64, error) {
	body := map[string]any{
		"chat_id":                  chatID,
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": false,
	}
	if replyMarkup != nil {
		body["reply_markup"] = replyMarkup
	}
	return c.call(ctx, "sendMessage", body)
}

// DeleteMessage removes a previously-sent message.
func (c *Client) DeleteMessage(ctx context.Context, chatID string, messageID int64) error {
	body := map[string]any{
		"chat_id":    chatID,
		"message_id": messageID,
	}
	_, err := c.call(ctx, "deleteMessage", body)
	return err
}

// call executes an API method with retries.
func (c *Client) call(ctx context.Context, method string, body map[string]any) (int64, error) {
	if c.dryRun || c.token == "" {
		c.log.Info("telegram dry-run",
			zap.String("method", method),
			zap.Any("body", redact(body)),
		)
		return 0, ErrDisabled
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return 0, fmt.Errorf("marshal body: %w", err)
	}

	const maxAttempts = 3
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		default:
		}

		msgID, retryAfter, err := c.doOnce(ctx, method, payload)
		if err == nil {
			return msgID, nil
		}
		lastErr = err
		if errors.Is(err, ErrFatal) {
			return 0, err
		}
		// Respect Telegram's retry_after header when given; otherwise exp backoff.
		sleep := time.Duration(retryAfter) * time.Second
		if sleep == 0 {
			// 500ms, 1.5s, 4.5s with jitter
			base := time.Duration(500*attempt*attempt) * time.Millisecond
			jitter := time.Duration(rand.Int63n(int64(200 * time.Millisecond)))
			sleep = base + jitter
		}
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-time.After(sleep):
		}
	}
	return 0, fmt.Errorf("telegram %s failed after %d attempts: %w", method, maxAttempts, lastErr)
}

// doOnce performs a single HTTP attempt. Returns (messageID, retryAfterSeconds, err).
func (c *Client) doOnce(ctx context.Context, method string, payload []byte) (int64, int, error) {
	url := "https://api.telegram.org/bot" + c.token + "/" + method
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return 0, 0, fmt.Errorf("build request: %w", scrubErr(err))
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("transport: %w", scrubErr(err))
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return 0, 0, fmt.Errorf("read body: %w", err)
	}

	var env tgResponse
	if err := json.Unmarshal(raw, &env); err != nil {
		return 0, 0, fmt.Errorf("decode envelope: %w", err)
	}

	if env.OK {
		var msg tgMessage
		if len(env.Result) > 0 {
			_ = json.Unmarshal(env.Result, &msg)
		}
		return msg.MessageID, 0, nil
	}

	retryAfter := 0
	if env.Parameters != nil && env.Parameters.RetryAfter > 0 {
		retryAfter = env.Parameters.RetryAfter
	}

	// 401/403/400 are fatal - no retry. Log scrubbed description only.
	switch env.ErrorCode {
	case 400, 401, 403, 404:
		c.log.Error("telegram fatal",
			zap.Int("code", env.ErrorCode),
			zap.String("description", scrub(env.Description)),
			zap.String("method", method),
		)
		return 0, 0, fmt.Errorf("%w: code=%d", ErrFatal, env.ErrorCode)
	}

	return 0, retryAfter, fmt.Errorf("telegram %s error %d: %s", method, env.ErrorCode, scrub(env.Description))
}

// scrubErr wraps an error so its string form has tokens scrubbed.
func scrubErr(err error) error {
	if err == nil {
		return nil
	}
	return errors.New(scrub(err.Error()))
}

// redact clones a body for logging with sensitive-looking fields masked.
// Telegram bodies do not carry secrets, but we still mask long tokenish fields
// as defense in depth.
func redact(body map[string]any) map[string]any {
	out := make(map[string]any, len(body))
	for k, v := range body {
		switch s := v.(type) {
		case string:
			if len(s) > 128 {
				out[k] = s[:64] + "...[truncated]"
			} else {
				out[k] = scrub(s)
			}
		default:
			out[k] = v
		}
	}
	return out
}
