package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"

	"github.com/malvex/vibediff/internal/git"
	"github.com/malvex/vibediff/internal/review"
)

// validateComment rejects malformed or unsafe review comments.
func validateComment(c *review.Comment) error {
	if strings.TrimSpace(c.Content) == "" {
		return fmt.Errorf("content is empty")
	}
	if len(c.Content) > maxCommentContent {
		return fmt.Errorf("content too long")
	}
	if c.Line < 1 {
		return fmt.Errorf("line must be >= 1")
	}
	if c.LineEnd != 0 && c.LineEnd < 1 {
		return fmt.Errorf("lineEnd must be >= 1")
	}
	if _, err := git.ValidateRepoPath(c.File); err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}
	return nil
}

type Handler struct {
	gitService  *git.Service
	reviewStore *review.Store
	format      string
}

func NewHandler(gitService *git.Service, reviewStore *review.Store) *Handler {
	return &Handler{
		gitService:  gitService,
		reviewStore: reviewStore,
	}
}

func (h *Handler) SetFormat(format string) {
	h.format = format
}

// writeJSON is a helper method to reduce repetitive JSON response code
func (h *Handler) writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("encode response: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

func (h *Handler) GetDiff(w http.ResponseWriter, r *http.Request) {
	diffType := git.DiffType(r.URL.Query().Get("type"))
	if diffType == "" {
		diffType = git.DiffTypeAll
	}

	// Optional comparison target (branch/tag) selected in the UI. Validate it
	// against the known refs so a crafted value can't be passed to git.
	target := r.URL.Query().Get("target")
	if target != "" && !h.gitService.IsValidRef(target) {
		http.Error(w, "unknown diff target", http.StatusBadRequest)
		return
	}

	diff, err := h.gitService.GetDiffForTarget(target, diffType)
	if err != nil {
		log.Printf("get diff: %v", err)
		http.Error(w, "failed to get diff", http.StatusInternalServerError)
		return
	}

	result := map[string]interface{}{
		"files":  diff.Files,
		"type":   diffType,
		"target": target,
	}

	h.writeJSON(w, result)
}

// GetRefs returns the local branches and tags available as diff targets.
func (h *Handler) GetRefs(w http.ResponseWriter, r *http.Request) {
	refs, err := h.gitService.GetRefs()
	if err != nil {
		log.Printf("get refs: %v", err)
		http.Error(w, "failed to list refs", http.StatusInternalServerError)
		return
	}
	if refs == nil {
		refs = []git.Ref{}
	}
	h.writeJSON(w, refs)
}

func (h *Handler) GetFileDiff(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename, err := url.QueryUnescape(vars["file"])
	if err != nil {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}

	diffType := git.DiffType(r.URL.Query().Get("type"))
	if diffType == "" {
		diffType = git.DiffTypeAll
	}

	target := r.URL.Query().Get("target")
	if target != "" && !h.gitService.IsValidRef(target) {
		http.Error(w, "unknown diff target", http.StatusBadRequest)
		return
	}

	diff, err := h.gitService.GetFileDiffForTarget(target, filename, diffType)
	if err != nil {
		log.Printf("get file diff %q: %v", filename, err)
		http.Error(w, "failed to get file diff", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, diff)
}

// maxCommentBytes bounds the request body for review comments to prevent
// memory-exhaustion from an oversized payload.
const maxCommentBytes = 1 << 20 // 1 MiB

// maxCommentContent bounds a single comment's text.
const maxCommentContent = 10000

func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxCommentBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var comment review.Comment
	if err := dec.Decode(&comment); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := validateComment(&comment); err != nil {
		http.Error(w, "invalid comment", http.StatusBadRequest)
		return
	}

	h.reviewStore.AddComment(&comment)

	// Print immediately in text format
	if h.format == "text" {
		if comment.LineEnd != 0 && comment.LineEnd != comment.Line {
			fmt.Printf("\n%s:%d-%d\n", comment.File, comment.Line, comment.LineEnd)
		} else {
			fmt.Printf("\n%s:%d\n", comment.File, comment.Line)
		}
		fmt.Printf("%s\n", comment.Content)
	}

	h.writeJSON(w, comment)
}

func (h *Handler) GetComments(w http.ResponseWriter, r *http.Request) {
	file := r.URL.Query().Get("file")

	var comments []*review.Comment
	if file != "" {
		comments = h.reviewStore.GetComments(file)
	} else {
		comments = h.reviewStore.GetAllComments()
	}

	h.writeJSON(w, comments)
}

func (h *Handler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	r.Body = http.MaxBytesReader(w, r.Body, maxCommentBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var body struct {
		Content string `json:"content"`
	}
	if err := dec.Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	content := strings.TrimSpace(body.Content)
	if content == "" || len(body.Content) > maxCommentContent {
		http.Error(w, "invalid comment", http.StatusBadRequest)
		return
	}

	if h.reviewStore.UpdateComment(id, content) {
		w.WriteHeader(http.StatusNoContent)
	} else {
		http.Error(w, "Comment not found", http.StatusNotFound)
	}
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if h.reviewStore.DeleteComment(id) {
		w.WriteHeader(http.StatusNoContent)
	} else {
		http.Error(w, "Comment not found", http.StatusNotFound)
	}
}

func (h *Handler) GetFullFileWithDiff(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename, err := url.QueryUnescape(vars["file"])
	if err != nil {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}

	diffType := git.DiffType(r.URL.Query().Get("type"))
	if diffType == "" {
		diffType = git.DiffTypeAll
	}

	target := r.URL.Query().Get("target")
	if target != "" && !h.gitService.IsValidRef(target) {
		http.Error(w, "unknown diff target", http.StatusBadRequest)
		return
	}

	diff, err := h.gitService.GetFileDiffWithFullContextForTarget(target, filename, diffType)
	if err != nil {
		log.Printf("get full file %q: %v", filename, err)
		http.Error(w, "failed to get file", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, diff)
}

func (h *Handler) GetFileContent(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "Missing file path", http.StatusBadRequest)
		return
	}

	content, err := h.gitService.GetFileContent(filePath)
	if err != nil {
		log.Printf("read file %q: %v", filePath, err)
		http.Error(w, "failed to read file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	if _, err := w.Write([]byte(content)); err != nil {
		log.Printf("Failed to write file content: %v", err)
	}
}
