package watcher

import (
	"context"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

// GitWatcher monitors git status for changes
type GitWatcher struct {
	hub          ChangeNotifier
	lastStatus   string
	pollInterval time.Duration
	done         chan bool
	statusFunc   func() (string, error)
}

// ChangeNotifier interface for notifying changes
type ChangeNotifier interface {
	NotifyChange(changeType string)
}

// gitStatus returns the porcelain status of the repository in the current dir.
// It is bounded by a timeout so a hung `git status` can't permanently stall the
// poll loop (which would silently stop live updates).
func gitStatus() (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, "git", "status", "--porcelain").Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

// detectChangeType classifies a porcelain status string into a change kind.
func detectChangeType(status string) string {
	switch {
	case strings.Contains(status, "??"):
		return "file_added"
	case strings.Contains(status, " D "):
		return "file_deleted"
	default:
		return "file_changed"
	}
}

// NewGitWatcher creates a new git watcher
func NewGitWatcher(hub ChangeNotifier) *GitWatcher {
	return &GitWatcher{
		hub:          hub,
		pollInterval: 1 * time.Second,
		done:         make(chan bool),
		statusFunc:   gitStatus,
	}
}

// Start begins monitoring for changes
func (w *GitWatcher) Start() {
	go func() {
		ticker := time.NewTicker(w.pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				w.checkForChanges()
			case <-w.done:
				if os.Getenv("VIBEDIFF_DEBUG") == "true" {
					log.Println("Git watcher stopped")
				}
				return
			}
		}
	}()
}

// Stop stops the watcher
func (w *GitWatcher) Stop() {
	select {
	case <-w.done:
		// Already closed
	default:
		close(w.done)
	}
}

func (w *GitWatcher) checkForChanges() {
	currentStatus, err := w.statusFunc()
	if err != nil {
		if os.Getenv("VIBEDIFF_DEBUG") == "true" {
			log.Printf("Error checking git status: %v", err)
		}
		return
	}

	// Only notify when the status actually changed since the last poll.
	if currentStatus != w.lastStatus {
		w.lastStatus = currentStatus
		w.hub.NotifyChange(detectChangeType(currentStatus))
	}
}
