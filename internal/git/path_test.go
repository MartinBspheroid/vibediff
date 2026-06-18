package git

import "testing"

func TestSafeRepoPath_Allowed(t *testing.T) {
	allowed := []string{"main.go", "internal/git/service.go", "./README.md", "a/b/c.txt"}
	for _, p := range allowed {
		if _, err := safeRepoPath(p); err != nil {
			t.Errorf("expected %q to be allowed, got error: %v", p, err)
		}
	}
}

func TestSafeRepoPath_Rejected(t *testing.T) {
	rejected := []string{"", "../etc/passwd", "../../secret", "/etc/passwd", "a/../../b"}
	for _, p := range rejected {
		if _, err := safeRepoPath(p); err == nil {
			t.Errorf("expected %q to be rejected, but it was allowed", p)
		}
	}
}

func TestSafeRepoPath_CleansBackInside(t *testing.T) {
	got, err := safeRepoPath("a/../main.go")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "main.go" {
		t.Errorf("safeRepoPath(\"a/../main.go\") = %q, want %q", got, "main.go")
	}
}
