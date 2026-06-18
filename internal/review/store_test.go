package review

import (
	"sync"
	"testing"
)

func TestStore_AddAndGetAll(t *testing.T) {
	s := NewStore()
	c := &Comment{File: "a.go", Line: 10, Content: "hi"}
	s.AddComment(c)

	if c.ID == "" {
		t.Error("AddComment did not assign an ID")
	}
	if c.CreatedAt.IsZero() {
		t.Error("AddComment did not set CreatedAt")
	}
	all := s.GetAllComments()
	if len(all) != 1 {
		t.Fatalf("GetAllComments len = %d, want 1", len(all))
	}
	if all[0].Content != "hi" {
		t.Errorf("content = %q, want hi", all[0].Content)
	}
}

func TestStore_GetCommentsFiltersByFile(t *testing.T) {
	s := NewStore()
	s.AddComment(&Comment{File: "a.go", Line: 1, Content: "one"})
	s.AddComment(&Comment{File: "b.go", Line: 1, Content: "two"})
	s.AddComment(&Comment{File: "a.go", Line: 2, Content: "three"})

	got := s.GetComments("a.go")
	if len(got) != 2 {
		t.Errorf("GetComments(a.go) len = %d, want 2", len(got))
	}
	for _, c := range got {
		if c.File != "a.go" {
			t.Errorf("got comment for wrong file: %q", c.File)
		}
	}
}

func TestStore_DeleteComment(t *testing.T) {
	s := NewStore()
	c := &Comment{File: "a.go", Line: 1, Content: "x"}
	s.AddComment(c)

	if !s.DeleteComment(c.ID) {
		t.Error("DeleteComment returned false for existing comment")
	}
	if s.DeleteComment("nonexistent-id") {
		t.Error("DeleteComment returned true for missing comment")
	}
	if len(s.GetAllComments()) != 0 {
		t.Error("comment not removed after delete")
	}
}

func TestStore_UpdateComment(t *testing.T) {
	s := NewStore()
	c := &Comment{File: "a.go", Line: 1, Content: "original"}
	s.AddComment(c)

	if !s.UpdateComment(c.ID, "edited") {
		t.Fatal("UpdateComment returned false for existing comment")
	}
	got := s.GetAllComments()
	if len(got) != 1 || got[0].Content != "edited" {
		t.Errorf("after update, comments = %+v, want content 'edited'", got)
	}
	if s.UpdateComment("missing-id", "x") {
		t.Error("UpdateComment returned true for missing comment")
	}
}

// Run with -race to verify the mutex actually protects concurrent access.
func TestStore_ConcurrentAdds(t *testing.T) {
	s := NewStore()
	const n = 100
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			s.AddComment(&Comment{File: "a.go", Line: 1, Content: "c"})
		}()
	}
	wg.Wait()

	all := s.GetAllComments()
	if len(all) != n {
		t.Fatalf("expected %d comments, got %d", n, len(all))
	}
	ids := make(map[string]bool, n)
	for _, c := range all {
		if ids[c.ID] {
			t.Errorf("duplicate ID generated: %q", c.ID)
		}
		ids[c.ID] = true
	}
}
