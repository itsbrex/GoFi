package cmd

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/d-fi/GoFi/utils"
)

type existingTrackMatch struct {
	SourcePath string
	LinkPath   string
}

func linkExistingTrackIfConfigured(destinationDir string, customFilename string, quality int) (*existingTrackMatch, bool, error) {
	ext := "mp3"
	if quality == 9 {
		ext = "flac"
	}

	linkPath := filepath.Join(destinationDir, fmt.Sprintf("%s.%s", utils.SanitizeFileName(customFilename), ext))
	if _, err := os.Lstat(linkPath); err == nil {
		return &existingTrackMatch{SourcePath: linkPath, LinkPath: linkPath}, false, nil
	} else if !os.IsNotExist(err) {
		return nil, false, fmt.Errorf("failed to inspect destination %q: %w", linkPath, err)
	}

	if !symlinkExisting {
		return nil, false, nil
	}

	sourcePath, err := findExistingTrackFile(linkPath, filepath.Base(linkPath), defaultOutputSearchRoots(destinationDir))
	if err != nil {
		return nil, false, err
	}
	if sourcePath == "" {
		return nil, false, nil
	}

	if err := os.MkdirAll(destinationDir, 0755); err != nil {
		return nil, false, fmt.Errorf("failed to create symlink destination directory %q: %w", destinationDir, err)
	}
	if err := os.Symlink(sourcePath, linkPath); err != nil {
		return nil, false, fmt.Errorf("failed to symlink existing track %q -> %q: %w", linkPath, sourcePath, err)
	}

	return &existingTrackMatch{SourcePath: sourcePath, LinkPath: linkPath}, true, nil
}

func findExistingTrackFile(destinationPath string, filename string, roots []string) (string, error) {
	destinationAbs, err := filepath.Abs(destinationPath)
	if err != nil {
		return "", err
	}

	for _, root := range roots {
		info, err := os.Stat(root)
		if err != nil || !info.IsDir() {
			continue
		}

		var found string
		walkErr := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			if entry.IsDir() {
				return nil
			}
			if !strings.EqualFold(entry.Name(), filename) {
				return nil
			}

			candidateAbs, err := filepath.Abs(path)
			if err != nil {
				return nil
			}
			if candidateAbs == destinationAbs {
				return nil
			}
			found = candidateAbs
			return fs.SkipAll
		})
		if walkErr != nil {
			return "", walkErr
		}
		if found != "" {
			return found, nil
		}
	}

	return "", nil
}
