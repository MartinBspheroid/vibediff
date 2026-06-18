package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/malvex/vibediff/internal/git"
	"github.com/malvex/vibediff/internal/handlers"
	"github.com/malvex/vibediff/internal/review"
)

// chdirTestRepo creates a throwaway git repo with one committed + one modified
// file and chdir's into it (the git service runs in the process CWD).
func chdirTestRepo(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "t@e.com")
	run("config", "user.name", "T")
	run("config", "commit.gpgsign", "false")
	if err := os.WriteFile(dir+"/seed.txt", []byte("a\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-m", "init")
	if err := os.WriteFile(dir+"/seed.txt", []byte("a\nb\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
}

func testRouter(t *testing.T) http.Handler {
	t.Helper()
	chdirTestRepo(t)
	handler := handlers.NewHandler(git.NewService(), review.NewStore())
	wsHub := handlers.NewWSHub()
	distFS := fstest.MapFS{
		"index.html":    {Data: []byte("<!doctype html><title>VibeDiff</title>")},
		"assets/app.js": {Data: []byte("console.log('hi')")},
	}
	return newRouter(handler, wsHub, distFS)
}

func TestRouter_ServesSPAIndexForUnknownRoutes(t *testing.T) {
	r := testRouter(t)
	for _, path := range []string{"/", "/some/client/route"} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, want 200", path, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "VibeDiff") {
			t.Errorf("GET %s did not serve index.html (body=%q)", path, rec.Body.String())
		}
	}
}

func TestRouter_ServesStaticAssets(t *testing.T) {
	r := testRouter(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("asset status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "console.log") {
		t.Errorf("asset body = %q, want the JS content", rec.Body.String())
	}
}

func TestRouter_APIDiffRoute(t *testing.T) {
	r := testRouter(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/diff", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("/api/diff status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "files") {
		t.Errorf("/api/diff body missing files key: %q", rec.Body.String())
	}
}

func TestRouter_CommentCRUDRoutesWired(t *testing.T) {
	r := testRouter(t)

	// POST a comment.
	postRec := httptest.NewRecorder()
	r.ServeHTTP(postRec, httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(`{"file":"seed.txt","line":1,"content":"hi"}`)))
	if postRec.Code != http.StatusOK {
		t.Fatalf("POST comment status = %d, want 200", postRec.Code)
	}

	// GET comments lists it.
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, httptest.NewRequest(http.MethodGet, "/api/review/comments", nil))
	if getRec.Code != http.StatusOK || !strings.Contains(getRec.Body.String(), "hi") {
		t.Errorf("GET comments = %d %q", getRec.Code, getRec.Body.String())
	}
}
