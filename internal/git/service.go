package git

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// defaultCmdTimeout bounds how long any single git invocation may run, so a
// hung or pathologically-slow command (e.g. full-context diff of a huge file)
// surfaces as an error instead of blocking the request indefinitely.
const defaultCmdTimeout = 30 * time.Second

type Service struct {
	diffTarget string
	cmdTimeout time.Duration
}

func NewService() *Service {
	return &Service{cmdTimeout: defaultCmdTimeout}
}

// SetCommandTimeout overrides the per-command timeout (primarily for tests).
func (s *Service) SetCommandTimeout(d time.Duration) {
	s.cmdTimeout = d
}

// SetDiffTarget sets the target for git diff (e.g., "main", "HEAD~1", commit hash)
func (s *Service) SetDiffTarget(target string) {
	s.diffTarget = target
}

// GetDiff retrieves the git diff using the service's configured target (set via
// the CLI) with optional context lines (default: 3).
func (s *Service) GetDiff(diffType DiffType, contextLines ...int) (*DiffResult, error) {
	return s.GetDiffForTarget("", diffType, false, contextLines...)
}

// GetDiffForTarget retrieves the diff against an explicit, per-request target
// (e.g. a branch or tag selected in the UI). An empty target falls back to the
// service's configured target, then to the staged/unstaged/all behavior. The
// caller is responsible for validating that target is a known, safe ref.
// When ignoreWhitespace is true, whitespace-only changes are hidden (git -w).
func (s *Service) GetDiffForTarget(target string, diffType DiffType, ignoreWhitespace bool, contextLines ...int) (*DiffResult, error) {
	context := 3
	if len(contextLines) > 0 {
		context = contextLines[0]
	}

	effectiveTarget := s.diffTarget
	if target != "" {
		effectiveTarget = target
	}

	var args []string

	// If a diff target is specified, use it instead of the default behavior.
	if effectiveTarget != "" {
		args = []string{"diff", effectiveTarget, "--no-color", "--no-ext-diff"}
	} else {
		switch diffType {
		case DiffTypeStaged:
			args = []string{"diff", "--cached", "--no-color", "--no-ext-diff"}
		case DiffTypeUnstaged:
			args = []string{"diff", "--no-color", "--no-ext-diff"}
		default:
			if s.hasCommits() {
				args = []string{"diff", "HEAD", "--no-color", "--no-ext-diff"}
			} else {
				// No commits yet: `git diff HEAD` would fail. Compare the index
				// against the (implicit) empty tree so staged files still show.
				args = []string{"diff", "--cached", "--no-color", "--no-ext-diff"}
			}
		}
	}

	// Force the standard a/ b/ path prefixes regardless of the user's git
	// config (diff.noprefix / diff.mnemonicPrefix would otherwise break parsing).
	args = append(args, "--src-prefix=a/", "--dst-prefix=b/")

	// Add context parameter
	if context >= 0 {
		args = append(args, fmt.Sprintf("-U%d", context))
	}

	// Hide whitespace-only changes when requested (common review noise filter).
	if ignoreWhitespace {
		args = append(args, "-w")
	}

	output, err := s.runGitCommand(args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get diff: %w", err)
	}

	files, err := s.parseDiff(output)
	if err != nil {
		return nil, fmt.Errorf("failed to parse diff: %w", err)
	}

	// Get untracked files and add them to the diff
	if diffType == DiffTypeUnstaged || diffType == DiffTypeAll {
		untrackedFiles, err := s.getUntrackedFiles()
		if err == nil && len(untrackedFiles) > 0 {
			for _, filepath := range untrackedFiles {
				fileDiff, err := s.getUntrackedFileDiff(filepath, context)
				if err == nil && fileDiff != nil {
					files = append(files, *fileDiff)
				}
			}
		}
	}

	return &DiffResult{
		Files: files,
		Type:  diffType,
	}, nil
}

// GetRefs lists local branches and tags that can be selected as diff targets.
func (s *Service) GetRefs() ([]Ref, error) {
	current, _ := s.runGitCommand("rev-parse", "--abbrev-ref", "HEAD")
	current = strings.TrimSpace(current)

	output, err := s.runGitCommand("for-each-ref", "--format=%(refname:short)%09%(refname)", "refs/heads", "refs/tags")
	if err != nil {
		return nil, fmt.Errorf("failed to list refs: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	refs := make([]Ref, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		short, full := parts[0], parts[1]
		typ := "branch"
		if strings.HasPrefix(full, "refs/tags/") {
			typ = "tag"
		}
		refs = append(refs, Ref{
			Name:    short,
			Type:    typ,
			Current: typ == "branch" && short == current,
		})
	}
	return refs, nil
}

// hasCommits reports whether the repository has at least one commit (a HEAD).
func (s *Service) hasCommits() bool {
	_, err := s.runGitCommand("rev-parse", "--verify", "HEAD")
	return err == nil
}

// IsGitRepo reports whether the current working directory is inside a git
// working tree.
func (s *Service) IsGitRepo() bool {
	out, err := s.runGitCommand("rev-parse", "--is-inside-work-tree")
	return err == nil && strings.TrimSpace(out) == "true"
}

// IsValidRef reports whether name matches one of the refs from GetRefs. Callers
// use this to validate a user-supplied diff target before passing it to git,
// preventing option-injection via crafted target strings.
func (s *Service) IsValidRef(name string) bool {
	refs, err := s.GetRefs()
	if err != nil {
		return false
	}
	for _, r := range refs {
		if r.Name == name {
			return true
		}
	}
	return false
}

func (s *Service) runGitCommand(args ...string) (string, error) {
	out, err := s.runGitCommandRaw(args...)
	return string(out), err
}

// runGitCommandRaw is like runGitCommand but returns the raw stdout bytes,
// untouched — needed for binary content (e.g. serving an image blob) where a
// string round-trip or any trimming would corrupt the data.
func (s *Service) runGitCommandRaw(args ...string) ([]byte, error) {
	timeout := s.cmdTimeout
	if timeout <= 0 {
		timeout = defaultCmdTimeout
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// core.quotePath=false makes git emit literal UTF-8 paths instead of
	// octal-escaped, double-quoted ones, so the parser handles non-ASCII
	// filenames (and paths with special characters) correctly.
	fullArgs := append([]string{"-c", "core.quotePath=false"}, args...)
	cmd := exec.CommandContext(ctx, "git", fullArgs...)
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("git command timed out after %s", timeout)
	}
	if err != nil {
		return nil, fmt.Errorf("git command failed: %s", stderr.String())
	}

	return out.Bytes(), nil
}

// GetWorkingTreeBytes reads the raw bytes of a file from the working tree, after
// validating the path stays inside the repository.
func (s *Service) GetWorkingTreeBytes(filePath string) ([]byte, error) {
	safe, err := safeRepoPath(filePath)
	if err != nil {
		return nil, fmt.Errorf("invalid file path: %w", err)
	}
	return os.ReadFile(safe)
}

// GetBlobBytesAtHEAD reads the raw bytes of a file as of HEAD (the "before" side
// of a diff), after validating the path.
func (s *Service) GetBlobBytesAtHEAD(filePath string) ([]byte, error) {
	safe, err := safeRepoPath(filePath)
	if err != nil {
		return nil, fmt.Errorf("invalid file path: %w", err)
	}
	return s.runGitCommandRaw("show", "HEAD:"+safe)
}

func (s *Service) parseDiff(diffOutput string) ([]FileDiff, error) {
	if diffOutput == "" {
		return []FileDiff{}, nil
	}

	parser := newDiffParser(diffOutput)
	return parser.parse()
}

func (s *Service) GetFileContent(filePath string) (string, error) {
	safe, err := safeRepoPath(filePath)
	if err != nil {
		return "", fmt.Errorf("invalid file path: %w", err)
	}
	// Prefer the committed version (HEAD); fall back to the working tree.
	content, err := s.runGitCommand("show", "HEAD:"+safe)
	if err == nil {
		return content, nil
	}
	output, readErr := os.ReadFile(safe)
	if readErr != nil {
		return "", fmt.Errorf("failed to read file: %w", readErr)
	}
	return string(output), nil
}

// GetFileDiff retrieves diff for a specific file with optional context lines.
func (s *Service) GetFileDiff(filename string, diffType DiffType, contextLines ...int) (*FileDiff, error) {
	return s.GetFileDiffForTarget("", filename, diffType, false, contextLines...)
}

// GetFileDiffForTarget retrieves the diff for a single file against an explicit
// per-request target (e.g. a branch/tag selected in the UI). An empty target
// falls back to the configured/default behavior.
func (s *Service) GetFileDiffForTarget(target string, filename string, diffType DiffType, ignoreWhitespace bool, contextLines ...int) (*FileDiff, error) {
	context := 3
	if len(contextLines) > 0 {
		context = contextLines[0]
	}

	// Untracked files only exist in the working tree (no target comparison).
	if target == "" {
		untrackedFiles, err := s.getUntrackedFiles()
		if err == nil {
			for _, untracked := range untrackedFiles {
				if untracked == filename {
					return s.getUntrackedFileDiff(filename, context)
				}
			}
		}
	}

	// Otherwise get from regular diff
	diff, err := s.GetDiffForTarget(target, diffType, ignoreWhitespace, contextLines...)
	if err != nil {
		return nil, err
	}

	for _, file := range diff.Files {
		if file.Path == filename {
			return &file, nil
		}
	}

	return nil, fmt.Errorf("file not found in diff: %s", filename)
}

// GetFileDiffWithFullContext is a convenience method for getting full file context.
func (s *Service) GetFileDiffWithFullContext(filename string, diffType DiffType) (*FileDiff, error) {
	return s.GetFileDiffForTarget("", filename, diffType, false, 999999)
}

// GetFileDiffWithFullContextForTarget returns full-context file diff against a target.
func (s *Service) GetFileDiffWithFullContextForTarget(target string, filename string, diffType DiffType) (*FileDiff, error) {
	return s.GetFileDiffForTarget(target, filename, diffType, false, 999999)
}

// isBinaryContent reports whether data looks binary, using git's heuristic:
// a NUL byte within the first 8000 bytes.
func isBinaryContent(data []byte) bool {
	n := len(data)
	if n > 8000 {
		n = 8000
	}
	return bytes.IndexByte(data[:n], 0) >= 0
}

// getUntrackedFiles returns list of untracked files from git status
func (s *Service) getUntrackedFiles() ([]string, error) {
	output, err := s.runGitCommand("ls-files", "--others", "--exclude-standard")
	if err != nil {
		return nil, err
	}

	if output == "" {
		return []string{}, nil
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	var files []string
	for _, line := range lines {
		if line != "" {
			files = append(files, line)
		}
	}

	return files, nil
}

// getUntrackedFileDiff creates a diff for an untracked file
func (s *Service) getUntrackedFileDiff(filepath string, contextLines int) (*FileDiff, error) {
	// Read file content (validated to stay within the repository root).
	safe, err := safeRepoPath(filepath)
	if err != nil {
		return nil, fmt.Errorf("invalid untracked file path: %w", err)
	}
	content, err := os.ReadFile(safe)
	if err != nil {
		return nil, fmt.Errorf("failed to read untracked file %s: %w", safe, err)
	}

	// Don't render binary files as text (they'd show as garbage rows); flag
	// them like git does for tracked binaries.
	if isBinaryContent(content) {
		return &FileDiff{
			Path:     filepath,
			Status:   FileStatusAdded,
			IsBinary: true,
			Hunks:    []Hunk{},
		}, nil
	}

	// Split into lines, dropping the single trailing newline so a file ending
	// in "\n" doesn't produce a spurious extra blank line (and a wrong count).
	text := strings.TrimSuffix(string(content), "\n")
	var lines []string
	if text != "" {
		lines = strings.Split(text, "\n")
	}

	// Create diff lines showing all lines as added
	diffLines := make([]Line, 0, len(lines))
	for i, line := range lines {
		lineNum := i + 1
		diffLines = append(diffLines, Line{
			Type:      LineTypeAdded,
			NewNumber: &lineNum,
			Content:   line,
		})
	}

	// An empty new file has no content hunk (matches git's behavior).
	hunks := []Hunk{}
	if len(lines) > 0 {
		hunks = []Hunk{
			{
				OldStart: 0,
				OldLines: 0,
				NewStart: 1,
				NewLines: len(lines),
				Header:   fmt.Sprintf("@@ -0,0 +1,%d @@", len(lines)),
				Lines:    diffLines,
			},
		}
	}

	return &FileDiff{
		Path:      filepath,
		Status:    FileStatusAdded,
		Additions: len(lines),
		Deletions: 0,
		IsBinary:  false,
		Hunks:     hunks,
	}, nil
}
