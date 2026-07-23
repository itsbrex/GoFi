package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/d-fi/GoFi/internal/ui"
	"github.com/d-fi/GoFi/internal/utils"
	"github.com/spf13/cobra"
)

func resolveDownloadPath(cmd *cobra.Command, contentType utils.ParsedURLType, fallback string) (string, error) {
	path := fallback
	if flagChanged(cmd, "output") {
		if flag := cmd.Flag("output"); flag != nil {
			path = flag.Value.String()
		}
	} else {
		if typeSpecific := outputPathForContentType(contentType); typeSpecific != "" {
			path = typeSpecific
		}
	}
	if strings.TrimSpace(path) == "" {
		path = "./downloads"
	}

	expanded, err := expandOutputPath(path)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(expanded, 0755); err != nil {
		return "", fmt.Errorf("failed to create download directory %q: %w", expanded, err)
	}

	absPath, err := filepath.Abs(expanded)
	if err != nil {
		return "", fmt.Errorf("failed to resolve download path %q: %w", expanded, err)
	}
	return absPath, nil
}

func outputPathForContentType(contentType utils.ParsedURLType) string {
	switch contentType {
	case utils.SpotifyTrack, utils.DeezerTrack:
		return trackOutputPath
	case utils.SpotifyAlbum, utils.DeezerAlbum:
		return albumOutputPath
	case utils.SpotifyPlaylist, utils.DeezerPlaylist:
		return playlistOutputPath
	default:
		return ""
	}
}

func expandOutputPath(path string) (string, error) {
	path = strings.TrimSpace(os.ExpandEnv(path))
	if path == "" {
		return "", nil
	}
	if path == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return home, nil
	}
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, strings.TrimPrefix(path, "~/")), nil
	}
	return path, nil
}

func flagChanged(cmd *cobra.Command, name string) bool {
	if cmd == nil {
		return false
	}
	if flag := cmd.Flag(name); flag != nil && flag.Changed {
		return true
	}
	if root := cmd.Root(); root != nil {
		if flag := root.PersistentFlags().Lookup(name); flag != nil && flag.Changed {
			return true
		}
	}
	return false
}

func printResolvedDownloadPath(path string) {
	ui.InfoWithIcon("Saving downloads to: %s", path)
}

func defaultOutputSearchRoots(activeDestination string) []string {
	candidates := []string{
		activeDestination,
		trackOutputPath,
		albumOutputPath,
		playlistOutputPath,
		downloadPath,
	}
	candidates = append(candidates, symlinkSearchDirs...)

	seen := make(map[string]struct{}, len(candidates))
	roots := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		expanded, err := expandOutputPath(candidate)
		if err != nil || strings.TrimSpace(expanded) == "" {
			continue
		}
		absPath, err := filepath.Abs(expanded)
		if err != nil {
			continue
		}
		if _, ok := seen[absPath]; ok {
			continue
		}
		seen[absPath] = struct{}{}
		roots = append(roots, absPath)
	}
	return roots
}
