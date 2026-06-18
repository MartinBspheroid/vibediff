package git

import "testing"

func TestParse_EmptyInput(t *testing.T) {
	files, err := newDiffParser("").parse()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) != 0 {
		t.Errorf("expected 0 files for empty input, got %d", len(files))
	}
}

func TestParse_SimpleModification(t *testing.T) {
	diff := `diff --git a/hello.txt b/hello.txt
index 1234567..89abcde 100644
--- a/hello.txt
+++ b/hello.txt
@@ -1,3 +1,3 @@
 line one
-line two
+line two changed
 line three
`
	files, err := newDiffParser(diff).parse()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	f := files[0]
	if f.Path != "hello.txt" {
		t.Errorf("Path = %q, want hello.txt", f.Path)
	}
	if f.Status != FileStatusModified {
		t.Errorf("Status = %q, want %q", f.Status, FileStatusModified)
	}
	if f.Additions != 1 || f.Deletions != 1 {
		t.Errorf("Additions/Deletions = %d/%d, want 1/1", f.Additions, f.Deletions)
	}
	if len(f.Hunks) != 1 {
		t.Fatalf("expected 1 hunk, got %d", len(f.Hunks))
	}
	h := f.Hunks[0]
	if h.OldStart != 1 || h.OldLines != 3 || h.NewStart != 1 || h.NewLines != 3 {
		t.Errorf("hunk header parsed wrong: oldStart=%d oldLines=%d newStart=%d newLines=%d",
			h.OldStart, h.OldLines, h.NewStart, h.NewLines)
	}
	// Verify line types: context, deleted, added, context.
	wantTypes := []LineType{LineTypeContext, LineTypeDeleted, LineTypeAdded, LineTypeContext}
	if len(h.Lines) != len(wantTypes) {
		t.Fatalf("expected %d lines, got %d", len(wantTypes), len(h.Lines))
	}
	for i, wt := range wantTypes {
		if h.Lines[i].Type != wt {
			t.Errorf("line %d type = %q, want %q", i, h.Lines[i].Type, wt)
		}
	}
}

func TestParse_NewFile(t *testing.T) {
	diff := `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+first
+second
`
	files, _ := newDiffParser(diff).parse()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if files[0].Status != FileStatusAdded {
		t.Errorf("Status = %q, want %q", files[0].Status, FileStatusAdded)
	}
	if files[0].Additions != 2 {
		t.Errorf("Additions = %d, want 2", files[0].Additions)
	}
}

func TestParse_DeletedFile(t *testing.T) {
	diff := `diff --git a/gone.txt b/gone.txt
deleted file mode 100644
index 1234567..0000000
--- a/gone.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-first
-second
`
	files, _ := newDiffParser(diff).parse()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if files[0].Status != FileStatusDeleted {
		t.Errorf("Status = %q, want %q", files[0].Status, FileStatusDeleted)
	}
}

func TestParse_BinaryFile(t *testing.T) {
	diff := `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/image.png differ
`
	files, _ := newDiffParser(diff).parse()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if !files[0].IsBinary {
		t.Errorf("IsBinary = false, want true")
	}
}

func TestParse_HunkHeaderWithoutCounts(t *testing.T) {
	// "@@ -1 +1 @@" omits explicit line counts; both default to 1.
	diff := `diff --git a/one.txt b/one.txt
index 1234567..89abcde 100644
--- a/one.txt
+++ b/one.txt
@@ -1 +1 @@
-old
+new
`
	files, _ := newDiffParser(diff).parse()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	h := files[0].Hunks[0]
	if h.OldLines != 1 || h.NewLines != 1 {
		t.Errorf("default counts: oldLines=%d newLines=%d, want 1/1", h.OldLines, h.NewLines)
	}
}

func TestParse_MultipleFiles(t *testing.T) {
	diff := `diff --git a/a.txt b/a.txt
index 111..222 100644
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-a
+A
diff --git a/b.txt b/b.txt
index 333..444 100644
--- a/b.txt
+++ b/b.txt
@@ -1 +1 @@
-b
+B
`
	files, _ := newDiffParser(diff).parse()
	if len(files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(files))
	}
	if files[0].Path != "a.txt" || files[1].Path != "b.txt" {
		t.Errorf("paths = %q, %q; want a.txt, b.txt", files[0].Path, files[1].Path)
	}
}
