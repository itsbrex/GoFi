package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/d-fi/GoFi/api"
	"github.com/d-fi/GoFi/download"
	"github.com/d-fi/GoFi/internal/models"
	"github.com/d-fi/GoFi/internal/services/spotify"
	"github.com/d-fi/GoFi/internal/ui"
	internalutils "github.com/d-fi/GoFi/internal/utils"
	"github.com/d-fi/GoFi/types"
	"github.com/d-fi/GoFi/utils"
	"github.com/vbauerster/mpb/v8"
)

// downloadHandlerImproved processes downloads with improved UI
func downloadHandlerImproved(url string, downloadPath string, quality int, concurrency int) error {
	ctx := context.Background()
	
	// Parse the URL to identify its type
	parsedInfo, err := internalutils.ParseMusicURL(url)
	if err != nil {
		ui.ErrorWithIcon("Failed to parse URL: %v", err)
		return err
	}

	// Handle Spotify URLs
	if parsedInfo.Source == "spotify" {
		return handleSpotifyDownloadImproved(ctx, parsedInfo, downloadPath, quality, concurrency)
	}

	// Handle Deezer URLs directly
	if parsedInfo.Source == "deezer" {
		return handleDeezerDownloadImproved(ctx, parsedInfo, downloadPath, quality, concurrency)
	}

	ui.ErrorWithIcon("Unsupported URL source: %s", parsedInfo.Source)
	return fmt.Errorf("unsupported URL source: %s", parsedInfo.Source)
}

// handleSpotifyDownloadImproved processes Spotify URLs with improved UI
func handleSpotifyDownloadImproved(ctx context.Context, parsedInfo *internalutils.ParsedURLInfo, downloadPath string, quality int, concurrency int) error {
	// Get the Spotify client
	client, _ := getAuthenticatedSpotifyClient(ctx)
	if client == nil {
		ui.ErrorWithIcon("Could not get authenticated Spotify client")
		ui.InfoWithIcon("Run 'gofi auth spotify' to authenticate first")
		return fmt.Errorf("could not get authenticated Spotify client")
	}

	// Create Spotify service
	spotifyService := spotify.NewSpotifyService(client)
	if spotifyService == nil {
		ui.ErrorWithIcon("Failed to initialize Spotify service")
		return fmt.Errorf("failed to initialize Spotify service")
	}

	// Process based on content type
	switch parsedInfo.Type {
	case internalutils.SpotifyTrack:
		return handleSpotifyTrackImproved(ctx, spotifyService, parsedInfo.ID, downloadPath, quality)
	
	case internalutils.SpotifyAlbum:
		return handleSpotifyAlbumImproved(ctx, spotifyService, parsedInfo.ID, downloadPath, quality, concurrency)
	
	case internalutils.SpotifyPlaylist:
		return handleSpotifyPlaylistImproved(ctx, spotifyService, parsedInfo.ID, downloadPath, quality, concurrency)
	
	default:
		ui.ErrorWithIcon("Unsupported Spotify content type: %s", parsedInfo.Type)
		return fmt.Errorf("unsupported Spotify content type: %s", parsedInfo.Type)
	}
}

// handleDeezerDownloadImproved processes Deezer URLs with improved UI
func handleDeezerDownloadImproved(ctx context.Context, parsedInfo *internalutils.ParsedURLInfo, downloadPath string, quality int, concurrency int) error {
	// Process based on content type
	switch parsedInfo.Type {
	case internalutils.DeezerTrack:
		return handleDeezerTrackImproved(parsedInfo.ID, downloadPath, quality)
	
	case internalutils.DeezerAlbum:
		return handleDeezerAlbumImproved(parsedInfo.ID, downloadPath, quality, concurrency)
	
	case internalutils.DeezerPlaylist:
		return handleDeezerPlaylistImproved(parsedInfo.ID, downloadPath, quality, concurrency)
	
	default:
		ui.ErrorWithIcon("Unsupported Deezer content type: %s", parsedInfo.Type)
		return fmt.Errorf("unsupported Deezer content type: %s", parsedInfo.Type)
	}
}

// handleSpotifyTrackImproved handles downloading a single Spotify track with improved UI
func handleSpotifyTrackImproved(ctx context.Context, spotifyService *spotify.SpotifyService, id string, downloadPath string, quality int) error {
	ui.Header("═══ ♫ Spotify Track Download ═══")
	fmt.Println()
	
	// Fetch track from Spotify
	fmt.Print(ui.InfoString("🔍 Searching Spotify for track info... "))
	track, err := spotifyService.FetchTrack(ctx, id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to fetch track from Spotify: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Find matching track on Deezer
	fmt.Print(ui.InfoString("🔍 Searching Deezer for matching track... "))
	deezerTrack, err := api.SearchTrackOnDeezer(track)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to find track on Deezer: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Print track info
	fmt.Println()
	ui.InfoBold("Track Details:")
	fmt.Printf("  ♫ Title:   %s\n", deezerTrack.SNG_TITLE)
	fmt.Printf("  ♫ Artist:  %s\n", deezerTrack.ART_NAME)
	fmt.Printf("  ♫ Album:   %s\n", deezerTrack.ALB_TITLE)
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Create a folder with the artist name
	artistFolder := filepath.Join(downloadPath, deezerTrack.ART_NAME)

	// Custom filename for the track: Artist - Title
	customFilename := fmt.Sprintf("%s - %s", deezerTrack.ART_NAME, deezerTrack.SNG_TITLE)

	// Create progress manager for single track
	pm := ui.NewProgressManager()
	defer pm.Wait()

	bar := pm.AddDownloadBar(customFilename, 0)

	// Download the track
	return downloadTrackImproved(deezerTrack, artistFolder, quality, customFilename, bar)
}

// handleDeezerTrackImproved handles downloading a single Deezer track with improved UI
func handleDeezerTrackImproved(id string, downloadPath string, quality int) error {
	ui.Header("═══ ♫ Deezer Track Download ═══")
	fmt.Println()
	
	fmt.Print(ui.InfoString("🔍 Searching Deezer for track info... "))
	track, err := api.GetTrackInfo(id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to get track info from Deezer: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Print track info
	fmt.Println()
	ui.InfoBold("Track Details:")
	fmt.Printf("  ♫ Title:   %s\n", track.SNG_TITLE)
	fmt.Printf("  ♫ Artist:  %s\n", track.ART_NAME)
	fmt.Printf("  ♫ Album:   %s\n", track.ALB_TITLE)
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Create a folder with the artist name
	artistFolder := filepath.Join(downloadPath, track.ART_NAME)

	// Custom filename for the track: Artist - Title
	customFilename := fmt.Sprintf("%s - %s", track.ART_NAME, track.SNG_TITLE)

	// Create progress manager for single track
	pm := ui.NewProgressManager()
	defer pm.Wait()

	bar := pm.AddDownloadBar(customFilename, 0)

	// Download the track
	return downloadTrackImproved(track, artistFolder, quality, customFilename, bar)
}

// handleSpotifyAlbumImproved handles downloading a Spotify album with improved UI
func handleSpotifyAlbumImproved(ctx context.Context, spotifyService *spotify.SpotifyService, id string, downloadPath string, quality int, concurrency int) error {
	ui.Header("═══ ♫ Spotify Album Download ═══")
	fmt.Println()
	
	fmt.Print(ui.InfoString("🔍 Searching Spotify for album info... "))
	album, tracks, err := spotifyService.FetchAlbum(ctx, id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to fetch album from Spotify: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	artistName := joinArtistNames(album.Artists)
	fmt.Println()
	ui.InfoBold("Album Details:")
	fmt.Printf("  ♫ Title:   %s\n", album.Title)
	fmt.Printf("  ♫ Artist:  %s\n", artistName)
	fmt.Printf("  ♫ Tracks:  %d\n", len(tracks))
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Find matching album on Deezer
	fmt.Print(ui.InfoString("🔍 Searching Deezer for matching album... "))
	deezerAlbum, err := api.SearchAlbumOnDeezer(album)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		ui.WarningWithIcon("Could not find album on Deezer. Trying to match individual tracks...")
		return downloadSpotifyTracksIndividuallyImproved(tracks, downloadPath, quality, "", concurrency)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Create a folder for the album
	albumPath := filepath.Join(downloadPath, deezerAlbum.ALB_TITLE)

	// Get album tracks
	albumTracks, err := api.GetAlbumTracks(fmt.Sprint(deezerAlbum.ALB_ID))
	if err != nil {
		ui.ErrorWithIcon("Failed to get album tracks from Deezer: %v", err)
		return fmt.Errorf("failed to get album tracks from Deezer: %v", err)
	}

	// Download the tracks
	total := len(albumTracks.Data)
	
	ui.InfoWithIcon("Starting download of %d tracks with %d concurrent downloads...", total, concurrency)
	fmt.Println()

	// Convert track data to downloadable tracks
	trackList := make([]types.TrackType, 0, total)
	for _, track := range albumTracks.Data {
		trackInfo, err := api.GetTrackInfo(fmt.Sprint(track.SNG_ID))
		if err != nil {
			ui.ErrorWithIcon("Failed to get info for: %s", track.SNG_TITLE)
			continue
		}
		trackList = append(trackList, trackInfo)
	}
	
	succeeded, failed := downloadTracksConcurrently(trackList, albumPath, quality, concurrency)

	fmt.Println()
	fmt.Println(strings.Repeat("─", 50))
	ui.InfoBold("Download Summary")
	fmt.Println(strings.Repeat("─", 50))
	
	if succeeded > 0 {
		ui.SuccessWithIcon("Succeeded: %d", succeeded)
	}
	if failed > 0 {
		ui.ErrorWithIcon("Failed:    %d", failed)
	}
	fmt.Printf("  Total:     %d\n", total)
	
	if failed == 0 {
		fmt.Println()
		ui.SuccessWithIcon("All downloads completed successfully!")
	} else if succeeded == 0 {
		fmt.Println()
		ui.ErrorWithIcon("All downloads failed.")
	} else {
		fmt.Println()
		ui.WarningWithIcon("Some downloads failed. Check the errors above.")
	}
	fmt.Println(strings.Repeat("─", 50))
	
	if failed > 0 {
		return fmt.Errorf("some tracks failed to download")
	}
	return nil
}

// handleDeezerAlbumImproved handles downloading a Deezer album with improved UI
func handleDeezerAlbumImproved(id string, downloadPath string, quality int, concurrency int) error {
	ui.Header("═══ ♫ Deezer Album Download ═══")
	fmt.Println()
	
	fmt.Print(ui.InfoString("🔍 Searching Deezer for album info... "))
	album, err := api.GetAlbumInfo(id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to get album info from Deezer: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Get album tracks
	albumTracks, err := api.GetAlbumTracks(id)
	if err != nil {
		ui.ErrorWithIcon("Failed to get album tracks from Deezer: %v", err)
		return fmt.Errorf("failed to get album tracks from Deezer: %v", err)
	}

	fmt.Println()
	ui.InfoBold("Album Details:")
	fmt.Printf("  ♫ Title:   %s\n", album.ALB_TITLE)
	fmt.Printf("  ♫ Artist:  %s\n", album.ART_NAME)
	fmt.Printf("  ♫ Tracks:  %d\n", len(albumTracks.Data))
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Create a folder for the album
	albumPath := filepath.Join(downloadPath, album.ALB_TITLE)

	// Download the tracks
	total := len(albumTracks.Data)
	
	ui.InfoWithIcon("Starting download of %d tracks with %d concurrent downloads...", total, concurrency)
	fmt.Println()

	// Convert track data to downloadable tracks
	trackList := make([]types.TrackType, 0, total)
	for _, track := range albumTracks.Data {
		trackInfo, err := api.GetTrackInfo(fmt.Sprint(track.SNG_ID))
		if err != nil {
			ui.ErrorWithIcon("Failed to get info for: %s", track.SNG_TITLE)
			continue
		}
		trackList = append(trackList, trackInfo)
	}
	
	succeeded, failed := downloadTracksConcurrently(trackList, albumPath, quality, concurrency)

	fmt.Println()
	fmt.Println(strings.Repeat("─", 50))
	ui.InfoBold("Download Summary")
	fmt.Println(strings.Repeat("─", 50))
	
	if succeeded > 0 {
		ui.SuccessWithIcon("Succeeded: %d", succeeded)
	}
	if failed > 0 {
		ui.ErrorWithIcon("Failed:    %d", failed)
	}
	fmt.Printf("  Total:     %d\n", total)
	
	if failed == 0 {
		fmt.Println()
		ui.SuccessWithIcon("All downloads completed successfully!")
	} else if succeeded == 0 {
		fmt.Println()
		ui.ErrorWithIcon("All downloads failed.")
	} else {
		fmt.Println()
		ui.WarningWithIcon("Some downloads failed. Check the errors above.")
	}
	fmt.Println(strings.Repeat("─", 50))
	
	if failed > 0 {
		return fmt.Errorf("some tracks failed to download")
	}
	return nil
}

// handleSpotifyPlaylistImproved handles downloading a Spotify playlist with improved UI
func handleSpotifyPlaylistImproved(ctx context.Context, spotifyService *spotify.SpotifyService, id string, downloadPath string, quality int, concurrency int) error {
	ui.Header("═══ ♫ Spotify Playlist Download ═══")
	fmt.Println()
	
	fmt.Print(ui.InfoString("🔍 Searching Spotify for playlist info... "))
	playlist, tracks, err := spotifyService.FetchPlaylist(ctx, id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to fetch playlist from Spotify: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	fmt.Println()
	ui.InfoBold("Playlist Details:")
	fmt.Printf("  ♫ Title:   %s\n", playlist.Title)
	if playlist.OwnerName != "" {
		fmt.Printf("  ♫ Owner:   %s\n", playlist.OwnerName)
	}
	fmt.Printf("  ♫ Tracks:  %d\n", len(tracks))
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Create a folder for the playlist using just the playlist name
	playlistPath := filepath.Join(downloadPath, playlist.Title)

	return downloadSpotifyTracksIndividuallyImproved(tracks, playlistPath, quality, "", concurrency)
}

// handleDeezerPlaylistImproved handles downloading a Deezer playlist with improved UI
func handleDeezerPlaylistImproved(id string, downloadPath string, quality int, concurrency int) error {
	ui.Header("═══ ♫ Deezer Playlist Download ═══")
	fmt.Println()
	
	fmt.Print(ui.InfoString("🔍 Searching Deezer for playlist info... "))
	playlist, err := api.GetPlaylistInfo(id)
	if err != nil {
		fmt.Println(ui.ErrorString("✗"))
		return fmt.Errorf("failed to get playlist info from Deezer: %v", err)
	}
	fmt.Println(ui.SuccessString("✓"))

	// Get playlist tracks
	tracks, err := api.GetPlaylistTracks(id)
	if err != nil {
		ui.ErrorWithIcon("Failed to get playlist tracks from Deezer: %v", err)
		return fmt.Errorf("failed to get playlist tracks from Deezer: %v", err)
	}

	fmt.Println()
	ui.InfoBold("Playlist Details:")
	fmt.Printf("  ♫ Title:   %s\n", playlist.Title)
	fmt.Printf("  ♫ Tracks:  %d\n", len(tracks.Data))
	fmt.Print("  ♫ Quality: ")
	switch quality {
	case 9:
		ui.Success("FLAC (Lossless)")
	case 3:
		ui.Info("MP3 320kbps")
	case 1:
		ui.Warning("MP3 128kbps")
	default:
		fmt.Printf("Quality %d\n", quality)
	}
	fmt.Println()

	// Create a folder for the playlist using just the playlist name
	playlistPath := filepath.Join(downloadPath, playlist.Title)

	// Download the tracks
	total := len(tracks.Data)
	
	ui.InfoWithIcon("Starting download of %d tracks with %d concurrent downloads...", total, concurrency)
	fmt.Println()

	// Convert track data to downloadable tracks
	trackList := make([]types.TrackType, 0, total)
	for _, track := range tracks.Data {
		trackInfo, err := api.GetTrackInfo(fmt.Sprint(track.SNG_ID))
		if err != nil {
			ui.ErrorWithIcon("Failed to get info for: %s by %s", track.SNG_TITLE, track.ART_NAME)
			continue
		}
		trackList = append(trackList, trackInfo)
	}
	
	succeeded, failed := downloadTracksConcurrently(trackList, playlistPath, quality, concurrency)

	fmt.Println()
	fmt.Println(strings.Repeat("─", 50))
	ui.InfoBold("Download Summary")
	fmt.Println(strings.Repeat("─", 50))
	
	if succeeded > 0 {
		ui.SuccessWithIcon("Succeeded: %d", succeeded)
	}
	if failed > 0 {
		ui.ErrorWithIcon("Failed:    %d", failed)
	}
	fmt.Printf("  Total:     %d\n", total)
	
	if failed == 0 {
		fmt.Println()
		ui.SuccessWithIcon("All downloads completed successfully!")
	} else if succeeded == 0 {
		fmt.Println()
		ui.ErrorWithIcon("All downloads failed.")
	} else {
		fmt.Println()
		ui.WarningWithIcon("Some downloads failed. Check the errors above.")
	}
	fmt.Println(strings.Repeat("─", 50))

	if failed > 0 {
		return fmt.Errorf("%d out of %d tracks failed to download", failed, total)
	}
	return nil
}

// downloadSpotifyTracksIndividuallyImproved searches for and downloads each track individually with improved UI
func downloadSpotifyTracksIndividuallyImproved(tracks []models.Track, downloadPath string, quality int, playlistName string, concurrency int) error {
	total := len(tracks)
	
	ui.InfoWithIcon("Matching %d tracks from Spotify to Deezer with %d concurrent downloads...", total, concurrency)
	fmt.Println()

	succeeded, failed := downloadSpotifyTracksConcurrently(tracks, downloadPath, quality, concurrency)

	fmt.Println()
	fmt.Println(strings.Repeat("─", 50))
	ui.InfoBold("Download Summary")
	fmt.Println(strings.Repeat("─", 50))
	
	if succeeded > 0 {
		ui.SuccessWithIcon("Succeeded: %d", succeeded)
	}
	if failed > 0 {
		ui.ErrorWithIcon("Failed:    %d", failed)
	}
	fmt.Printf("  Total:     %d\n", total)
	
	if failed == 0 {
		fmt.Println()
		ui.SuccessWithIcon("All downloads completed successfully!")
	} else if succeeded == 0 {
		fmt.Println()
		ui.ErrorWithIcon("All downloads failed.")
	} else {
		fmt.Println()
		ui.WarningWithIcon("Some downloads failed. Check the errors above.")
	}
	fmt.Println(strings.Repeat("─", 50))

	if failed > 0 {
		return fmt.Errorf("%d out of %d tracks failed to download", failed, total)
	}
	return nil
}

// downloadTrackImproved downloads a single track from Deezer with improved UI
// If bar is nil, the download will proceed without a progress bar
func downloadTrackImproved(track types.TrackType, downloadPath string, quality int, customFilename string, bar *mpb.Bar) error {
	// Determine cover size based on quality
	coverSize := 500
	if quality == 9 {
		coverSize = 1000
	}

	// Create the directory if it doesn't exist
	if err := os.MkdirAll(downloadPath, 0755); err != nil {
		return fmt.Errorf("failed to create download directory: %v", err)
	}

	// Check if file already exists
	ext := "mp3"
	if quality == 9 {
		ext = "flac"
	}
	fullPath := filepath.Join(downloadPath, fmt.Sprintf("%s.%s", utils.SanitizeFileName(customFilename), ext))

	if _, err := os.Stat(fullPath); err == nil {
		// File exists - complete the bar and return
		if bar != nil {
			ui.CompleteBar(bar)
		}
		return nil
	}

	// Create a custom progress callback using mpb bar
	var progressCallback func(progress float64, downloaded, total int64)
	if bar != nil {
		callback := ui.CreateBarCallback(bar)
		progressCallback = func(_ float64, downloaded, total int64) {
			callback(downloaded, total)
		}
	}

	// Create download options
	options := download.DownloadTrackOptions{
		SngID:      fmt.Sprint(track.SNG_ID),
		Quality:    quality,
		CoverSize:  coverSize,
		SaveToDir:  downloadPath,
		Filename:   utils.SanitizeFileName(customFilename),
		OnProgress: progressCallback,
	}

	// Execute download
	_, err := download.DownloadTrack(options)
	if err != nil {
		if bar != nil {
			ui.AbortBar(bar)
		}
		return err
	}

	if bar != nil {
		ui.CompleteBar(bar)
	}

	return nil
}

// downloadTracksConcurrently downloads multiple tracks concurrently
func downloadTracksConcurrently(tracks []types.TrackType, downloadPath string, quality int, concurrency int) (succeeded int, failed int) {
	total := len(tracks)
	if total == 0 {
		return 0, 0
	}

	// Create progress manager
	pm := ui.NewProgressManager()
	defer pm.Wait()

	// Channel for work items (just tracks, not bars)
	workChan := make(chan types.TrackType, total)
	resultChan := make(chan bool, total)

	// Create wait group
	var wg sync.WaitGroup

	// Start worker goroutines
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for track := range workChan {
				// Custom filename for the track: Artist - Title
				customFilename := fmt.Sprintf("%s - %s", track.ART_NAME, track.SNG_TITLE)

				// Create progress bar for THIS track when worker starts
				bar := pm.AddDownloadBar(customFilename, 0)

				err := downloadTrackImproved(track, downloadPath, quality, customFilename, bar)
				if err != nil {
					resultChan <- false
				} else {
					resultChan <- true
				}
			}
		}(i)
	}

	// Send work to workers (no bars yet)
	for _, track := range tracks {
		workChan <- track
	}
	close(workChan)

	// Wait for all workers to finish
	wg.Wait()
	close(resultChan)

	// Count results
	for success := range resultChan {
		if success {
			succeeded++
		} else {
			failed++
		}
	}

	return succeeded, failed
}

// downloadSpotifyTracksConcurrently searches for and downloads Spotify tracks concurrently
func downloadSpotifyTracksConcurrently(tracks []models.Track, downloadPath string, quality int, concurrency int) (succeeded int, failed int) {
	total := len(tracks)
	if total == 0 {
		return 0, 0
	}

	// Create progress manager
	pm := ui.NewProgressManager()
	defer pm.Wait()

	// Channel for work items (just tracks, not bars)
	workChan := make(chan models.Track, total)
	resultChan := make(chan bool, total)

	// Create wait group
	var wg sync.WaitGroup

	// Mutex for thread-safe error output
	var outputMux sync.Mutex

	// Start worker goroutines
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for track := range workChan {
				trackName := fmt.Sprintf("%s by %s", track.Title, joinArtistNames(track.Artists))

				// Create progress bar for THIS track when worker starts
				bar := pm.AddDownloadBar(trackName, 0)

				// Add a small delay to avoid overwhelming the Deezer API
				time.Sleep(300 * time.Millisecond)

				deezerTrack, err := api.SearchTrackOnDeezer(&track)
				if err != nil {
					outputMux.Lock()
					ui.ErrorWithIcon("Not found on Deezer: %s", trackName)
					outputMux.Unlock()
					ui.AbortBar(bar)
					resultChan <- false
					continue
				}

				// Custom filename for the track: Artist - Title
				customFilename := fmt.Sprintf("%s - %s", deezerTrack.ART_NAME, deezerTrack.SNG_TITLE)

				err = downloadTrackImproved(deezerTrack, downloadPath, quality, customFilename, bar)
				if err != nil {
					outputMux.Lock()
					ui.ErrorWithIcon("Download failed: %s - %v", customFilename, err)
					outputMux.Unlock()
					resultChan <- false
				} else {
					resultChan <- true
				}
			}
		}(i)
	}

	// Send work to workers (no bars yet)
	for _, track := range tracks {
		workChan <- track
	}
	close(workChan)

	// Wait for all workers to finish
	wg.Wait()
	close(resultChan)

	// Count results
	for success := range resultChan {
		if success {
			succeeded++
		} else {
			failed++
		}
	}

	return succeeded, failed
}