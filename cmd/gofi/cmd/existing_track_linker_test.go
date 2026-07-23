package cmd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLinkExistingTrackIfConfiguredCreatesSymlinkFromSearchRoots(t *testing.T) {
	withSymlinkGlobals(t, func(tmp string) {
		symlinkExisting = true
		trackOutputPath = filepath.Join(tmp, "tracks")
		destinationDir := filepath.Join(tmp, "playlist", "Road Trip")

		sourcePath := filepath.Join(trackOutputPath, "Artist - Song.flac")
		if err := os.MkdirAll(filepath.Dir(sourcePath), 0755); err != nil {
			t.Fatalf("failed to create source dir: %v", err)
		}
		if err := os.WriteFile(sourcePath, []byte("audio"), 0644); err != nil {
			t.Fatalf("failed to write source file: %v", err)
		}

		match, linked, err := linkExistingTrackIfConfigured(destinationDir, "Artist - Song", 9)
		if err != nil {
			t.Fatalf("linkExistingTrackIfConfigured() returned error: %v", err)
		}
		if match == nil || !linked {
			t.Fatalf("expected symlinked existing match, got match=%v linked=%v", match, linked)
		}

		linkInfo, err := os.Lstat(match.LinkPath)
		if err != nil {
			t.Fatalf("expected symlink at %s: %v", match.LinkPath, err)
		}
		if linkInfo.Mode()&os.ModeSymlink == 0 {
			t.Fatalf("expected %s to be a symlink", match.LinkPath)
		}
		target, err := os.Readlink(match.LinkPath)
		if err != nil {
			t.Fatalf("failed to read symlink: %v", err)
		}
		if target != sourcePath {
			t.Fatalf("symlink target = %q, want %q", target, sourcePath)
		}
	})
}

func TestLinkExistingTrackIfConfiguredDoesNothingWhenDisabled(t *testing.T) {
	withSymlinkGlobals(t, func(tmp string) {
		symlinkExisting = false
		trackOutputPath = filepath.Join(tmp, "tracks")
		destinationDir := filepath.Join(tmp, "playlist")

		sourcePath := filepath.Join(trackOutputPath, "Artist - Song.flac")
		if err := os.MkdirAll(filepath.Dir(sourcePath), 0755); err != nil {
			t.Fatalf("failed to create source dir: %v", err)
		}
		if err := os.WriteFile(sourcePath, []byte("audio"), 0644); err != nil {
			t.Fatalf("failed to write source file: %v", err)
		}

		match, linked, err := linkExistingTrackIfConfigured(destinationDir, "Artist - Song", 9)
		if err != nil {
			t.Fatalf("linkExistingTrackIfConfigured() returned error: %v", err)
		}
		if match != nil || linked {
			t.Fatalf("expected no match when disabled, got match=%v linked=%v", match, linked)
		}
	})
}

func TestLinkExistingTrackIfConfiguredReportsExistingDestination(t *testing.T) {
	withSymlinkGlobals(t, func(tmp string) {
		symlinkExisting = true
		destinationDir := filepath.Join(tmp, "tracks")
		existingPath := filepath.Join(destinationDir, "Artist - Song.flac")
		if err := os.MkdirAll(destinationDir, 0755); err != nil {
			t.Fatalf("failed to create destination dir: %v", err)
		}
		if err := os.WriteFile(existingPath, []byte("audio"), 0644); err != nil {
			t.Fatalf("failed to write destination file: %v", err)
		}

		match, linked, err := linkExistingTrackIfConfigured(destinationDir, "Artist - Song", 9)
		if err != nil {
			t.Fatalf("linkExistingTrackIfConfigured() returned error: %v", err)
		}
		if match == nil || linked {
			t.Fatalf("expected existing destination without new symlink, got match=%v linked=%v", match, linked)
		}
		if match.SourcePath != existingPath || match.LinkPath != existingPath {
			t.Fatalf("match = %+v, want existing path %q", match, existingPath)
		}
	})
}

func withSymlinkGlobals(t *testing.T, fn func(tmp string)) {
	t.Helper()
	oldSymlinkExisting := symlinkExisting
	oldTrack := trackOutputPath
	oldAlbum := albumOutputPath
	oldPlaylist := playlistOutputPath
	oldDownload := downloadPath
	oldSearchDirs := symlinkSearchDirs
	t.Cleanup(func() {
		symlinkExisting = oldSymlinkExisting
		trackOutputPath = oldTrack
		albumOutputPath = oldAlbum
		playlistOutputPath = oldPlaylist
		downloadPath = oldDownload
		symlinkSearchDirs = oldSearchDirs
	})

	symlinkExisting = false
	trackOutputPath = ""
	albumOutputPath = ""
	playlistOutputPath = ""
	downloadPath = ""
	symlinkSearchDirs = nil
	fn(t.TempDir())
}
