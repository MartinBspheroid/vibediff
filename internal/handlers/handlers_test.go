package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/gorilla/mux"

	"github.com/malvex/vibediff/internal/git"
	"github.com/malvex/vibediff/internal/review"
)

// chdirTestRepo creates a throwaway git repo and chdir's into it so the git
// service (which runs in the process CWD) has something to diff.
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
	if err := os.WriteFile(dir+"/seed.txt", []byte("x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-m", "init")

	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
}

func newTestHandler() *Handler {
	gs := git.NewService()
	return NewHandler(gs, review.NewStore())
}

func TestAddComment_RoundTrip(t *testing.T) {
	h := newTestHandler()
	body := `{"file":"a.go","line":3,"content":"please fix"}`
	req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.AddComment(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("AddComment status = %d, want 200", rec.Code)
	}
	var created review.Comment
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("response not valid JSON: %v", err)
	}
	if created.ID == "" {
		t.Error("created comment has no ID")
	}

	// It should now be retrievable.
	getReq := httptest.NewRequest(http.MethodGet, "/api/review/comments", nil)
	getRec := httptest.NewRecorder()
	h.GetComments(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GetComments status = %d, want 200", getRec.Code)
	}
	var comments []*review.Comment
	if err := json.Unmarshal(getRec.Body.Bytes(), &comments); err != nil {
		t.Fatalf("comments not valid JSON: %v", err)
	}
	if len(comments) != 1 || comments[0].Content != "please fix" {
		t.Errorf("unexpected comments: %+v", comments)
	}
}

func TestAddComment_MalformedJSON(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader("{not json"))
	rec := httptest.NewRecorder()
	h.AddComment(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for malformed JSON", rec.Code)
	}
}

func TestAddComment_Validation(t *testing.T) {
	cases := map[string]string{
		"empty content":  `{"file":"a.go","line":1,"content":"   "}`,
		"zero line":      `{"file":"a.go","line":0,"content":"x"}`,
		"traversal file": `{"file":"../../etc/passwd","line":1,"content":"x"}`,
		"unknown field":  `{"file":"a.go","line":1,"content":"x","bogus":true}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			h := newTestHandler()
			req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(body))
			rec := httptest.NewRecorder()
			h.AddComment(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400 for %s", rec.Code, name)
			}
		})
	}
}

// A negative line number is how the client marks a comment on a deleted
// (old-side) line; it must be accepted, not rejected.
func TestAddComment_NegativeLineAccepted(t *testing.T) {
	h := newTestHandler()
	body := `{"file":"a.go","line":-5,"lineEnd":-5,"content":"on a deleted line"}`
	req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.AddComment(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 for a comment on a deleted line", rec.Code)
	}
}

func TestAddComment_BodyTooLarge(t *testing.T) {
	h := newTestHandler()
	huge := `{"file":"a.go","line":1,"content":"` + strings.Repeat("A", 2<<20) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(huge))
	rec := httptest.NewRecorder()
	h.AddComment(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for oversized body", rec.Code)
	}
}

func TestGetFileContent_ErrorIsSanitized(t *testing.T) {
	chdirTestRepo(t)
	h := newTestHandler()
	// A traversal path is rejected deep in the git service; the response must
	// not leak internal paths or git stderr.
	req := httptest.NewRequest(http.MethodGet, "/api/file?path=../../../../etc/passwd", nil)
	rec := httptest.NewRecorder()
	h.GetFileContent(rec, req)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	body := rec.Body.String()
	for _, leak := range []string{"/etc/passwd", "/tmp/", "escapes repository", "git "} {
		if strings.Contains(body, leak) {
			t.Errorf("response body leaks internal detail %q: %s", leak, body)
		}
	}
}

func TestDeleteComment(t *testing.T) {
	h := newTestHandler()
	// Seed a comment directly through the store the handler uses.
	addReq := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(`{"file":"a.go","line":1,"content":"x"}`))
	addRec := httptest.NewRecorder()
	h.AddComment(addRec, addReq)
	var created review.Comment
	_ = json.Unmarshal(addRec.Body.Bytes(), &created)

	router := mux.NewRouter()
	router.HandleFunc("/api/review/comment/{id}", h.DeleteComment).Methods("DELETE")

	// Existing id -> 204.
	delReq := httptest.NewRequest(http.MethodDelete, "/api/review/comment/"+created.ID, nil)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Errorf("delete existing status = %d, want 204", delRec.Code)
	}

	// Missing id -> 404.
	missReq := httptest.NewRequest(http.MethodDelete, "/api/review/comment/nope", nil)
	missRec := httptest.NewRecorder()
	router.ServeHTTP(missRec, missReq)
	if missRec.Code != http.StatusNotFound {
		t.Errorf("delete missing status = %d, want 404", missRec.Code)
	}
}

func TestGetFileContent_Success(t *testing.T) {
	chdirTestRepo(t)
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/file?path=seed.txt", nil)
	rec := httptest.NewRecorder()
	h.GetFileContent(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "x\n" {
		t.Errorf("body = %q, want %q", rec.Body.String(), "x\n")
	}
}

func TestGetFileContent_MissingPath(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/file", nil)
	rec := httptest.NewRecorder()
	h.GetFileContent(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for missing path", rec.Code)
	}
}

func TestGetFileDiff_FoundViaRouter(t *testing.T) {
	chdirTestRepo(t)
	// Modify the committed file so it appears in the diff.
	if err := os.WriteFile("seed.txt", []byte("x\nchanged\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := newTestHandler()
	router := mux.NewRouter()
	router.HandleFunc("/api/diff/{file:.+}", h.GetFileDiff).Methods("GET")

	req := httptest.NewRequest(http.MethodGet, "/api/diff/seed.txt", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var fd map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &fd); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}
	if fd["path"] != "seed.txt" {
		t.Errorf("path = %v, want seed.txt", fd["path"])
	}
}

func TestGetFileDiff_UnknownTargetRejected(t *testing.T) {
	chdirTestRepo(t)
	h := newTestHandler()
	router := mux.NewRouter()
	router.HandleFunc("/api/diff/{file:.+}", h.GetFileDiff).Methods("GET")

	req := httptest.NewRequest(http.MethodGet, "/api/diff/seed.txt?target=no-such-ref", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for unknown target", rec.Code)
	}
}

func TestGetFullFileWithDiff_OK(t *testing.T) {
	chdirTestRepo(t)
	if err := os.WriteFile("seed.txt", []byte("x\nmore\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := newTestHandler()
	router := mux.NewRouter()
	router.HandleFunc("/api/diff/{file:.+}/full", h.GetFullFileWithDiff).Methods("GET")

	req := httptest.NewRequest(http.MethodGet, "/api/diff/seed.txt/full", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestGetComments_FilterByFile(t *testing.T) {
	h := newTestHandler()
	for _, body := range []string{
		`{"file":"a.go","line":1,"content":"one"}`,
		`{"file":"b.go","line":1,"content":"two"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(body))
		h.AddComment(httptest.NewRecorder(), req)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/review/comments?file=a.go", nil)
	rec := httptest.NewRecorder()
	h.GetComments(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var comments []*review.Comment
	if err := json.Unmarshal(rec.Body.Bytes(), &comments); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}
	if len(comments) != 1 || comments[0].File != "a.go" {
		t.Errorf("filtered comments = %+v, want one for a.go", comments)
	}
}

func TestGetRefs_OK(t *testing.T) {
	chdirTestRepo(t)
	// chdirTestRepo commits a file on the default branch; add a branch + tag.
	exec.Command("git", "branch", "feature/y").Run()
	exec.Command("git", "tag", "v2").Run()

	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/refs", nil)
	rec := httptest.NewRecorder()
	h.GetRefs(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GetRefs status = %d, want 200", rec.Code)
	}
	var refs []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &refs); err != nil {
		t.Fatalf("refs not valid JSON: %v", err)
	}
	if len(refs) == 0 {
		t.Error("expected at least one ref")
	}
}

func TestGetDiff_RejectsUnknownTarget(t *testing.T) {
	chdirTestRepo(t)
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/diff?target=--output=/tmp/evil", nil)
	rec := httptest.NewRecorder()
	h.GetDiff(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for unknown/unsafe target", rec.Code)
	}
}

func TestUpdateComment(t *testing.T) {
	h := newTestHandler()
	addRec := httptest.NewRecorder()
	h.AddComment(addRec, httptest.NewRequest(http.MethodPost, "/api/review/comment", strings.NewReader(`{"file":"a.go","line":1,"content":"original"}`)))
	var created review.Comment
	_ = json.Unmarshal(addRec.Body.Bytes(), &created)

	router := mux.NewRouter()
	router.HandleFunc("/api/review/comment/{id}", h.UpdateComment).Methods("PUT")

	// Update existing -> 204, content changes.
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/review/comment/"+created.ID, strings.NewReader(`{"content":"edited"}`)))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("update status = %d, want 204", rec.Code)
	}
	if got := h.reviewStore.GetAllComments(); len(got) != 1 || got[0].Content != "edited" {
		t.Errorf("comment not updated: %+v", got)
	}

	// Empty content -> 400.
	badRec := httptest.NewRecorder()
	router.ServeHTTP(badRec, httptest.NewRequest(http.MethodPut, "/api/review/comment/"+created.ID, strings.NewReader(`{"content":"  "}`)))
	if badRec.Code != http.StatusBadRequest {
		t.Errorf("empty content status = %d, want 400", badRec.Code)
	}

	// Missing id -> 404.
	missRec := httptest.NewRecorder()
	router.ServeHTTP(missRec, httptest.NewRequest(http.MethodPut, "/api/review/comment/nope", strings.NewReader(`{"content":"x"}`)))
	if missRec.Code != http.StatusNotFound {
		t.Errorf("missing id status = %d, want 404", missRec.Code)
	}
}

func TestGetDiff_OK(t *testing.T) {
	chdirTestRepo(t)
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/diff", nil)
	rec := httptest.NewRecorder()
	h.GetDiff(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GetDiff status = %d, want 200", rec.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response not valid JSON: %v", err)
	}
	if _, ok := payload["files"]; !ok {
		t.Error("response missing 'files' key")
	}
}
