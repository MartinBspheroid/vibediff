package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// newTestRepo creates a throwaway git repo in a temp dir and chdir's into it
// for the duration of the test (Service runs git in the process CWD). These
// tests must not call t.Parallel() because they mutate the working directory.
func newTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@example.com")
	run("config", "user.name", "Test")
	run("config", "commit.gpgsign", "false")

	old, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
	return dir
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func gitIn(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, out)
	}
}

func TestService_GetDiff_Unstaged(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "hello.txt", "line one\nline two\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	writeFile(t, dir, "hello.txt", "line one\nline two changed\n")

	s := NewService()
	res, err := s.GetDiff(DiffTypeUnstaged)
	if err != nil {
		t.Fatalf("GetDiff: %v", err)
	}
	if len(res.Files) != 1 {
		t.Fatalf("expected 1 changed file, got %d", len(res.Files))
	}
	if res.Files[0].Path != "hello.txt" {
		t.Errorf("Path = %q, want hello.txt", res.Files[0].Path)
	}
}

// Regression: in a freshly-init'd repo with no commits, the "all" view ran
// `git diff HEAD` which fails; staged files must still show.
func TestService_IsGitRepo(t *testing.T) {
	newTestRepo(t) // chdir into a git repo
	s := NewService()
	if !s.IsGitRepo() {
		t.Error("expected IsGitRepo()=true inside a git repo")
	}

	// Switch to a non-git directory.
	repoDir, _ := os.Getwd()
	if err := os.Chdir(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(repoDir) }()
	if s.IsGitRepo() {
		t.Error("expected IsGitRepo()=false outside a git repo")
	}
}

func TestService_GetDiff_NoCommitsYet(t *testing.T) {
	dir := newTestRepo(t) // init + config, no commit
	writeFile(t, dir, "first.txt", "alpha\nbeta\n")
	gitIn(t, dir, "add", "first.txt")

	s := NewService()
	if s.hasCommits() {
		t.Fatal("expected hasCommits()=false in a no-commit repo")
	}
	res, err := s.GetDiff(DiffTypeAll)
	if err != nil {
		t.Fatalf("GetDiff in no-commit repo: %v", err)
	}
	var found bool
	for _, f := range res.Files {
		if f.Path == "first.txt" {
			found = true
		}
	}
	if !found {
		t.Errorf("staged file first.txt missing in no-commit repo, got %v", res.Files)
	}
}

func TestService_GetDiff_UntrackedFileAppears(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "committed.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	writeFile(t, dir, "brand-new.txt", "fresh\ncontent\n")

	s := NewService()
	res, err := s.GetDiff(DiffTypeAll)
	if err != nil {
		t.Fatalf("GetDiff: %v", err)
	}
	var found bool
	for _, f := range res.Files {
		if f.Path == "brand-new.txt" {
			found = true
			if f.Status != FileStatusAdded {
				t.Errorf("untracked file Status = %q, want %q", f.Status, FileStatusAdded)
			}
		}
	}
	if !found {
		t.Errorf("untracked file brand-new.txt not present in diff")
	}
}

func TestService_UntrackedFile_NoTrailingBlankLine(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "seed.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	// A 3-line file ending in a newline.
	writeFile(t, dir, "new.txt", "one\ntwo\nthree\n")

	s := NewService()
	fd, err := s.GetFileDiff("new.txt", DiffTypeAll)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if fd.Additions != 3 {
		t.Errorf("Additions = %d, want 3 (no spurious trailing blank line)", fd.Additions)
	}
	if len(fd.Hunks) != 1 || len(fd.Hunks[0].Lines) != 3 {
		t.Fatalf("expected 1 hunk with 3 lines, got %d hunks", len(fd.Hunks))
	}
	want := []string{"one", "two", "three"}
	for i, l := range fd.Hunks[0].Lines {
		if l.Content != want[i] {
			t.Errorf("line %d = %q, want %q", i, l.Content, want[i])
		}
	}
}

func TestService_UntrackedEmptyFile(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "seed.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	writeFile(t, dir, "empty.txt", "")

	s := NewService()
	fd, err := s.GetFileDiff("empty.txt", DiffTypeAll)
	if err != nil {
		t.Fatalf("GetFileDiff: %v", err)
	}
	if fd.Additions != 0 {
		t.Errorf("Additions = %d, want 0 for an empty file", fd.Additions)
	}
	if len(fd.Hunks) != 0 {
		t.Errorf("expected no hunks for an empty file, got %d", len(fd.Hunks))
	}
}

func TestService_GetFileDiff_NotFound(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")

	s := NewService()
	if _, err := s.GetFileDiff("does-not-exist.txt", DiffTypeAll); err == nil {
		t.Errorf("expected error for missing file, got nil")
	}
}

func TestService_GetFileContent_Committed(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "readme.md", "# Title\nbody\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")

	s := NewService()
	got, err := s.GetFileContent("readme.md")
	if err != nil {
		t.Fatalf("GetFileContent: %v", err)
	}
	if got != "# Title\nbody\n" {
		t.Errorf("content = %q, want committed content", got)
	}
}

func TestService_GetRefs(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "1\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	gitIn(t, dir, "branch", "feature/x")
	gitIn(t, dir, "tag", "v1.0.0")

	s := NewService()
	refs, err := s.GetRefs()
	if err != nil {
		t.Fatalf("GetRefs: %v", err)
	}

	byName := map[string]Ref{}
	for _, r := range refs {
		byName[r.Name] = r
	}
	if _, ok := byName["feature/x"]; !ok {
		t.Errorf("expected branch feature/x in refs, got %v", refs)
	}
	if v, ok := byName["v1.0.0"]; !ok || v.Type != "tag" {
		t.Errorf("expected tag v1.0.0, got %+v (ok=%v)", v, ok)
	}
	// The repo's default branch must be marked current.
	var sawCurrent bool
	for _, r := range refs {
		if r.Current && r.Type == "branch" {
			sawCurrent = true
		}
	}
	if !sawCurrent {
		t.Errorf("expected one current branch, got %v", refs)
	}
}

func TestService_IsValidRef(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "1\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	gitIn(t, dir, "branch", "feature/x")

	s := NewService()
	if !s.IsValidRef("feature/x") {
		t.Error("feature/x should be a valid ref")
	}
	for _, bad := range []string{"--output=/tmp/x", "nope", "", "; rm -rf /"} {
		if s.IsValidRef(bad) {
			t.Errorf("%q should not be a valid ref", bad)
		}
	}
}

func TestService_GetDiffForTarget(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "first\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "c1")
	// Tag the first commit, then add a second commit changing the file.
	gitIn(t, dir, "tag", "base")
	writeFile(t, dir, "a.txt", "first\nsecond\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "c2")

	s := NewService()
	// Diff the working tree against the "base" tag should show a.txt changed.
	res, err := s.GetDiffForTarget("base", DiffTypeAll)
	if err != nil {
		t.Fatalf("GetDiffForTarget: %v", err)
	}
	var found bool
	for _, f := range res.Files {
		if f.Path == "a.txt" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected a.txt in diff against base tag, got %v", res.Files)
	}
}

func TestService_GetFileDiffForTarget(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "first\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "c1")
	gitIn(t, dir, "tag", "base")
	writeFile(t, dir, "a.txt", "first\nsecond\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "c2")

	s := NewService()
	fd, err := s.GetFileDiffWithFullContextForTarget("base", "a.txt", DiffTypeAll)
	if err != nil {
		t.Fatalf("GetFileDiffWithFullContextForTarget: %v", err)
	}
	if fd.Path != "a.txt" {
		t.Errorf("Path = %q, want a.txt", fd.Path)
	}
	if fd.Additions == 0 {
		t.Errorf("expected additions when diffing a.txt against base, got %+v", fd)
	}
}

// Regression: a user with diff.noprefix=true would get prefix-less `diff --git`
// output that the parser can't read; we force a/ b/ prefixes to stay robust.
func TestService_GetDiff_RobustToNoPrefixConfig(t *testing.T) {
	dir := newTestRepo(t)
	gitIn(t, dir, "config", "diff.noprefix", "true")
	gitIn(t, dir, "config", "diff.mnemonicPrefix", "true")
	writeFile(t, dir, "file.txt", "a\nb\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	writeFile(t, dir, "file.txt", "a\nB\n")

	s := NewService()
	res, err := s.GetDiff(DiffTypeUnstaged)
	if err != nil {
		t.Fatalf("GetDiff: %v", err)
	}
	if len(res.Files) != 1 {
		t.Fatalf("expected 1 changed file despite diff.noprefix, got %d", len(res.Files))
	}
	if res.Files[0].Path != "file.txt" {
		t.Errorf("Path = %q, want file.txt", res.Files[0].Path)
	}
}

// Regression: with the default core.quotePath, git escapes/quotes non-ASCII
// filenames, which the parser can't read. We force core.quotePath=false.
func TestService_GetDiff_NonASCIIFilenames(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "café.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	// Modify the committed file and add an untracked non-ASCII file.
	writeFile(t, dir, "café.txt", "x\ny\n")
	writeFile(t, dir, "日本語.md", "新規\n")

	s := NewService()
	res, err := s.GetDiff(DiffTypeAll)
	if err != nil {
		t.Fatalf("GetDiff: %v", err)
	}
	paths := map[string]bool{}
	for _, f := range res.Files {
		paths[f.Path] = true
	}
	if !paths["café.txt"] {
		t.Errorf("modified non-ASCII file café.txt missing from diff, got %v", res.Files)
	}
	if !paths["日本語.md"] {
		t.Errorf("untracked non-ASCII file 日本語.md missing from diff, got %v", res.Files)
	}
}

func TestIsBinaryContent(t *testing.T) {
	if isBinaryContent([]byte("plain text\nlines\n")) {
		t.Error("text content flagged as binary")
	}
	if !isBinaryContent([]byte{0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d}) {
		t.Error("content with a NUL byte not flagged as binary")
	}
}

func TestService_GetDiff_UntrackedBinaryNotRenderedAsText(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "seed.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")
	// An untracked "binary" file (contains a NUL byte).
	if err := os.WriteFile(filepath.Join(dir, "logo.png"), []byte{0x89, 'P', 'N', 'G', 0x00, 0x1a, 0x0a}, 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewService()
	res, err := s.GetDiff(DiffTypeAll)
	if err != nil {
		t.Fatalf("GetDiff: %v", err)
	}
	var found bool
	for _, f := range res.Files {
		if f.Path == "logo.png" {
			found = true
			if !f.IsBinary {
				t.Error("untracked binary file not flagged IsBinary")
			}
			if len(f.Hunks) != 0 {
				t.Errorf("binary file should have no hunks, got %d", len(f.Hunks))
			}
		}
	}
	if !found {
		t.Error("untracked binary file missing from diff")
	}
}

func TestService_CommandTimeout(t *testing.T) {
	dir := newTestRepo(t)
	writeFile(t, dir, "a.txt", "x\n")
	gitIn(t, dir, "add", ".")
	gitIn(t, dir, "commit", "-m", "init")

	s := NewService()
	// A 1ns timeout expires before git can finish, so the command is bounded
	// and surfaces an error instead of blocking.
	s.SetCommandTimeout(time.Nanosecond)
	if _, err := s.GetStatus(); err == nil {
		t.Error("expected a timeout error with a 1ns command timeout, got nil")
	}

	// With a generous timeout the same call succeeds.
	s.SetCommandTimeout(30 * time.Second)
	if _, err := s.GetStatus(); err != nil {
		t.Errorf("expected success with a normal timeout, got %v", err)
	}
}

// Regression test for the path-traversal arbitrary file read (plan 002).
func TestService_GetFileContent_RejectsTraversal(t *testing.T) {
	newTestRepo(t)
	s := NewService()
	for _, bad := range []string{"../../../../etc/passwd", "/etc/passwd", "../secret"} {
		got, err := s.GetFileContent(bad)
		if err == nil {
			t.Errorf("GetFileContent(%q) should be rejected, returned %d bytes", bad, len(got))
		}
	}
}
