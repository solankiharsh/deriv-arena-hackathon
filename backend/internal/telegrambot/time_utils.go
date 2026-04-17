package telegrambot

import "time"

// utcLocation returns UTC; wrapper to keep scheduler.go free of time imports.
func utcLocation() *time.Location { return time.UTC }

// truncDay returns today's UTC date (YYYY-MM-DD) - used as part of dedupe
// payloads so the same daily digest does not re-post within a day.
func truncDay() string {
	return time.Now().UTC().Format("2006-01-02")
}

// weekStamp returns ISO year+week, used in weekly-recap dedupe payload.
func weekStamp() string {
	y, w := time.Now().UTC().ISOWeek()
	return fmtInt(y) + "-W" + fmtInt(w)
}

func fmtInt(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
