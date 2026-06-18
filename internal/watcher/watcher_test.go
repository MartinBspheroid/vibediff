package watcher

import (
	"sync"
	"testing"
)

func TestDetectChangeType(t *testing.T) {
	cases := map[string]string{
		"?? newfile.txt\n":     "file_added",
		" D removed.txt\n":     "file_deleted",
		" M modified.txt\n":    "file_changed",
		"M  staged.txt\n":      "file_changed",
		"":                     "file_changed",
		"?? a.txt\n D b.txt\n": "file_added", // untracked takes precedence
	}
	for status, want := range cases {
		if got := detectChangeType(status); got != want {
			t.Errorf("detectChangeType(%q) = %q, want %q", status, got, want)
		}
	}
}

// mockNotifier records the change types it receives.
type mockNotifier struct {
	mu      sync.Mutex
	changes []string
}

func (m *mockNotifier) NotifyChange(changeType string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.changes = append(m.changes, changeType)
}

func (m *mockNotifier) received() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.changes...)
}

func TestCheckForChanges_NotifiesOnlyOnChange(t *testing.T) {
	notifier := &mockNotifier{}
	w := NewGitWatcher(notifier)

	status := " M file.txt\n"
	w.statusFunc = func() (string, error) { return status, nil }

	// First poll: status differs from the initial empty lastStatus -> notify.
	w.checkForChanges()
	// Second poll with identical status: no new notification.
	w.checkForChanges()

	if got := notifier.received(); len(got) != 1 || got[0] != "file_changed" {
		t.Fatalf("after stable status, changes = %v, want one file_changed", got)
	}

	// Status changes to an untracked file -> a new file_added notification.
	status = "?? new.txt\n"
	w.checkForChanges()

	got := notifier.received()
	if len(got) != 2 || got[1] != "file_added" {
		t.Fatalf("after new untracked file, changes = %v, want [..., file_added]", got)
	}
}

func TestCheckForChanges_IgnoresStatusError(t *testing.T) {
	notifier := &mockNotifier{}
	w := NewGitWatcher(notifier)
	w.statusFunc = func() (string, error) { return "", errStatus }

	w.checkForChanges()
	if got := notifier.received(); len(got) != 0 {
		t.Errorf("expected no notifications on status error, got %v", got)
	}
}

var errStatus = &statusError{}

type statusError struct{}

func (*statusError) Error() string { return "git status failed" }
