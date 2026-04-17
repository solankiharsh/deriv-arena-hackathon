package tradingbot

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Allowlisted RSS feed hosts (SSRF prevention).
// Only these hosts can be fetched by the news collector.
var allowedFeedHosts = map[string]bool{
	"www.investing.com":     true,
	"www.forexlive.com":     true,
	"cryptopanic.com":       true,
	"feeds.marketwatch.com": true,
	"rss.cnn.com":           true,
}

// Default feed URLs (must resolve to allowedFeedHosts).
var defaultFeeds = []string{
	"https://www.investing.com/rss/news.rss",
	"https://www.forexlive.com/feed/news",
	"https://cryptopanic.com/news/rss/",
}

// NewsCollector fetches RSS feeds and computes simple keyword sentiment.
type NewsCollector struct {
	feeds  []string
	mu     sync.RWMutex
	cache  map[string]*cachedNews
	client *http.Client
	logger *zap.Logger
}

type cachedNews struct {
	sentiment *NewsSentiment
	at        time.Time
}

// NewNewsCollector returns a collector seeded with default allowlisted feeds.
func NewNewsCollector(logger *zap.Logger) *NewsCollector {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &NewsCollector{
		feeds:  defaultFeeds,
		cache:  make(map[string]*cachedNews),
		client: &http.Client{Timeout: 10 * time.Second},
		logger: logger,
	}
}

// GetLatestSentiment returns sentiment, using a 5-minute cache by filter key.
func (nc *NewsCollector) GetLatestSentiment(ctx context.Context, filters []string) *NewsSentiment {
	key := strings.Join(filters, ",")
	nc.mu.RLock()
	if c, ok := nc.cache[key]; ok && time.Since(c.at) < 5*time.Minute {
		nc.mu.RUnlock()
		return c.sentiment
	}
	nc.mu.RUnlock()

	items := nc.fetchAll(ctx, filters)
	score := nc.calculateSentiment(items)
	headlines := make([]string, 0, len(items))
	for i, it := range items {
		if i >= 5 {
			break
		}
		headlines = append(headlines, it.Title)
	}

	result := &NewsSentiment{
		Score:           score,
		ItemCount:       len(items),
		UpdatedAt:       time.Now(),
		RecentHeadlines: headlines,
		Items:           items,
	}

	nc.mu.Lock()
	nc.cache[key] = &cachedNews{sentiment: result, at: time.Now()}
	nc.mu.Unlock()
	return result
}

func (nc *NewsCollector) fetchAll(ctx context.Context, filters []string) []NewsItem {
	var all []NewsItem
	for _, feedURL := range nc.feeds {
		items, err := nc.fetchFeed(ctx, feedURL, filters)
		if err != nil {
			nc.logger.Warn("rss fetch failed", zap.String("feed", feedURL), zap.Error(err))
			continue
		}
		all = append(all, items...)
	}
	return all
}

// fetchFeed enforces the SSRF allowlist on each fetch.
func (nc *NewsCollector) fetchFeed(ctx context.Context, feedURL string, filters []string) ([]NewsItem, error) {
	u, err := url.Parse(feedURL)
	if err != nil {
		return nil, fmt.Errorf("parse url: %w", err)
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return nil, fmt.Errorf("disallowed scheme: %s", u.Scheme)
	}
	if !allowedFeedHosts[u.Host] {
		return nil, fmt.Errorf("host %s not in allowlist", u.Host)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "DerivArena-TradingBot/1.0")

	resp, err := nc.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	// Limit read size to 2MB to prevent memory exhaustion.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}

	return nc.parseRSS(body, u.Host, filters), nil
}

type rssFeed struct {
	Channel struct {
		Items []struct {
			Title       string `xml:"title"`
			Link        string `xml:"link"`
			Description string `xml:"description"`
			PubDate     string `xml:"pubDate"`
		} `xml:"item"`
	} `xml:"channel"`
}

func (nc *NewsCollector) parseRSS(body []byte, source string, filters []string) []NewsItem {
	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		nc.logger.Debug("rss parse failed", zap.Error(err))
		return nil
	}

	var items []NewsItem
	for _, it := range feed.Channel.Items {
		title := strings.TrimSpace(it.Title)
		if title == "" {
			continue
		}
		if !matchesFilters(title+" "+it.Description, filters) {
			continue
		}
		pubDate, _ := time.Parse(time.RFC1123Z, it.PubDate)
		items = append(items, NewsItem{
			Title:       title,
			Link:        it.Link,
			Description: strings.TrimSpace(it.Description),
			PubDate:     pubDate,
			Sentiment:   scoreText(title + " " + it.Description),
			Source:      source,
		})
		if len(items) >= 20 {
			break
		}
	}
	return items
}

func matchesFilters(text string, filters []string) bool {
	if len(filters) == 0 {
		return true
	}
	lc := strings.ToLower(text)
	for _, f := range filters {
		if strings.Contains(lc, strings.ToLower(f)) {
			return true
		}
	}
	return false
}

var (
	positiveKW = []string{"rally", "bullish", "surge", "gain", "profit", "growth", "jump", "soar", "record high", "breakthrough"}
	negativeKW = []string{"crash", "bearish", "drop", "loss", "decline", "risk", "plunge", "fall", "fear", "selloff"}
)

func scoreText(text string) float64 {
	lc := strings.ToLower(text)
	var pos, neg int
	for _, kw := range positiveKW {
		pos += strings.Count(lc, kw)
	}
	for _, kw := range negativeKW {
		neg += strings.Count(lc, kw)
	}
	if pos+neg == 0 {
		return 0
	}
	return float64(pos-neg) / float64(pos+neg)
}

func (nc *NewsCollector) calculateSentiment(items []NewsItem) float64 {
	if len(items) == 0 {
		return 0
	}
	var total float64
	for _, it := range items {
		total += it.Sentiment
	}
	return total / float64(len(items))
}
