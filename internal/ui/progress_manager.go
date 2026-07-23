package ui

import (
	"io"
	"time"

	"github.com/vbauerster/mpb/v8"
	"github.com/vbauerster/mpb/v8/decor"
)

// ProgressManager wraps mpb for managing multiple concurrent progress bars
type ProgressManager struct {
	container *mpb.Progress
}

// NewProgressManager creates a new progress manager
func NewProgressManager() *ProgressManager {
	return &ProgressManager{
		container: mpb.New(
			mpb.WithWidth(64),
			mpb.WithRefreshRate(100*time.Millisecond), // 10 FPS
		),
	}
}

// AddDownloadBar creates a new progress bar for a download
func (pm *ProgressManager) AddDownloadBar(name string, total int64) *mpb.Bar {
	// Truncate name if too long
	maxLen := 35
	if len(name) > maxLen {
		name = name[:maxLen-3] + "..."
	}

	return pm.container.AddBar(total,
		mpb.PrependDecorators(
			decor.Name(IconDownload+" ", decor.WCSyncSpace),
			decor.Name(name, decor.WCSyncWidth),
		),
		mpb.AppendDecorators(
			decor.NewPercentage("%d", decor.WCSyncSpace),
			decor.Name(" (", decor.WCSyncSpace),
			decor.CountersKibiByte("%.1f/%.1f", decor.WCSyncSpace),
			decor.Name(", ", decor.WCSyncSpace),
			decor.EwmaSpeed(decor.SizeB1024(0), "%.1f", 60, decor.WCSyncSpace),
			decor.Name(") ", decor.WCSyncSpace),
			decor.OnComplete(
				decor.EwmaETA(decor.ET_STYLE_GO, 60, decor.WCSyncSpace),
				SuccessColor.Sprint(IconSuccess),
			),
		),
	)
}

// Wait waits for all progress bars to complete
func (pm *ProgressManager) Wait() {
	pm.container.Wait()
}

// Shutdown gracefully shuts down the progress manager
func (pm *ProgressManager) Shutdown() {
	pm.container.Shutdown()
}

// CreateProgressWriter creates an io.Writer that updates a progress bar
func CreateProgressWriter(bar *mpb.Bar, w io.Writer) io.Writer {
	return bar.ProxyWriter(w)
}

// IncrementBar is a helper to increment a progress bar
func IncrementBar(bar *mpb.Bar, n int) {
	if bar != nil {
		bar.IncrInt64(int64(n))
	}
}

// SetTotal sets the total for a progress bar (useful when total is unknown initially)
func SetTotal(bar *mpb.Bar, total int64) {
	if bar != nil {
		bar.SetTotal(total, false)
	}
}

// CompleteBar marks a progress bar as complete
func CompleteBar(bar *mpb.Bar) {
	if bar != nil {
		bar.SetTotal(0, true) // Mark as complete
	}
}

// AbortBar aborts a progress bar (for errors)
func AbortBar(bar *mpb.Bar) {
	if bar != nil {
		bar.Abort(false)
	}
}

// ProgressCallback is a function type for download progress callbacks
type ProgressCallback func(downloaded, total int64)

// CreateBarCallback creates a progress callback that updates an mpb bar
func CreateBarCallback(bar *mpb.Bar) ProgressCallback {
	var lastDownloaded int64
	return func(downloaded, total int64) {
		if bar == nil {
			return
		}

		// Set total if it changed
		if bar.Current() == 0 && total > 0 {
			SetTotal(bar, total)
		}

		// Calculate increment since last update
		increment := downloaded - lastDownloaded
		if increment > 0 {
			IncrementBar(bar, int(increment))
			lastDownloaded = downloaded
		}
	}
}
