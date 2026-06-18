package git

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ValidateRepoPath is the exported form of safeRepoPath for callers in other
// packages (e.g. validating the file a review comment targets). It returns the
// cleaned repo-relative path, or an error if the path is unsafe.
func ValidateRepoPath(userPath string) (string, error) {
	return safeRepoPath(userPath)
}

// safeRepoPath validates that userPath refers to a file inside the repository
// working directory (the process's current working directory). It returns the
// cleaned, repo-relative path on success, or an error if the path is absolute,
// escapes the repo via "..", or cannot be resolved.
//
// This is the single chokepoint that prevents path-traversal arbitrary file
// reads (e.g. ?path=../../../../etc/passwd) through the file-serving endpoints.
func safeRepoPath(userPath string) (string, error) {
	if userPath == "" {
		return "", fmt.Errorf("empty path")
	}
	if filepath.IsAbs(userPath) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	root, err := filepath.Abs(".")
	if err != nil {
		return "", fmt.Errorf("cannot resolve repo root: %w", err)
	}

	clean := filepath.Clean(userPath)
	abs := filepath.Join(root, clean)

	// Ensure the resolved path is within root (defends against ../ escapes).
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes repository root")
	}
	return rel, nil
}
