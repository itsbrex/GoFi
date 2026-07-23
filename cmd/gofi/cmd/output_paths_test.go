package cmd

import (
	"path/filepath"
	"testing"

	internalutils "github.com/d-fi/GoFi/internal/utils"
	"github.com/spf13/cobra"
)

func TestResolveDownloadPathUsesContentSpecificDefault(t *testing.T) {
	withOutputPathGlobals(t, func(tmp string) {
		fallback := filepath.Join(tmp, "fallback")
		playlistOutputPath = filepath.Join(tmp, "playlist-default")

		cmd := testDownloadCommand()
		got, err := resolveDownloadPath(cmd, internalutils.SpotifyPlaylist, fallback)
		if err != nil {
			t.Fatalf("resolveDownloadPath() returned error: %v", err)
		}

		want, _ := filepath.Abs(playlistOutputPath)
		if got != want {
			t.Fatalf("resolveDownloadPath() = %q, want %q", got, want)
		}
	})
}

func TestResolveDownloadPathFallsBackToGlobalOutput(t *testing.T) {
	withOutputPathGlobals(t, func(tmp string) {
		fallback := filepath.Join(tmp, "fallback")

		cmd := testDownloadCommand()
		got, err := resolveDownloadPath(cmd, internalutils.SpotifyAlbum, fallback)
		if err != nil {
			t.Fatalf("resolveDownloadPath() returned error: %v", err)
		}

		want, _ := filepath.Abs(fallback)
		if got != want {
			t.Fatalf("resolveDownloadPath() = %q, want %q", got, want)
		}
	})
}

func TestResolveDownloadPathOutputFlagOverridesContentSpecificDefault(t *testing.T) {
	withOutputPathGlobals(t, func(tmp string) {
		explicit := filepath.Join(tmp, "explicit")
		playlistOutputPath = filepath.Join(tmp, "playlist-default")

		cmd := testDownloadCommand()
		if err := cmd.Root().PersistentFlags().Set("output", explicit); err != nil {
			t.Fatalf("failed to set output flag: %v", err)
		}

		got, err := resolveDownloadPath(cmd, internalutils.DeezerPlaylist, filepath.Join(tmp, "fallback"))
		if err != nil {
			t.Fatalf("resolveDownloadPath() returned error: %v", err)
		}

		want, _ := filepath.Abs(explicit)
		if got != want {
			t.Fatalf("resolveDownloadPath() = %q, want %q", got, want)
		}
	})
}

func TestExpandOutputPathExpandsTilde(t *testing.T) {
	got, err := expandOutputPath("~/Music/d-fi-music")
	if err != nil {
		t.Fatalf("expandOutputPath() returned error: %v", err)
	}
	if got == "~/Music/d-fi-music" || !filepath.IsAbs(got) {
		t.Fatalf("expandOutputPath() = %q, want absolute home path", got)
	}
}

func testDownloadCommand() *cobra.Command {
	root := &cobra.Command{Use: "gofi"}
	root.PersistentFlags().String("output", "", "")
	download := &cobra.Command{Use: "download"}
	root.AddCommand(download)
	return download
}

func withOutputPathGlobals(t *testing.T, fn func(tmp string)) {
	t.Helper()
	oldTrack := trackOutputPath
	oldAlbum := albumOutputPath
	oldPlaylist := playlistOutputPath
	t.Cleanup(func() {
		trackOutputPath = oldTrack
		albumOutputPath = oldAlbum
		playlistOutputPath = oldPlaylist
	})

	trackOutputPath = ""
	albumOutputPath = ""
	playlistOutputPath = ""
	fn(t.TempDir())
}
