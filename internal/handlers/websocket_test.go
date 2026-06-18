package handlers

import (
	"strings"
	"testing"
	"time"
)

func TestWSHub_RegisterBroadcastUnregister(t *testing.T) {
	hub := NewWSHub()
	go hub.Run()

	// A client with a buffered send channel; the broadcast path never touches
	// the (nil) conn, so this exercises the hub without a real socket.
	client := &WSClient{hub: hub, send: make(chan []byte, 8)}
	hub.register <- client

	hub.NotifyChange("file_changed")
	select {
	case msg := <-client.send:
		if !strings.Contains(string(msg), "file_changed") {
			t.Errorf("broadcast = %q, want it to contain file_changed", msg)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for broadcast")
	}

	// Unregistering closes the client's send channel.
	hub.unregister <- client
	select {
	case _, ok := <-client.send:
		if ok {
			t.Error("expected send channel to be closed after unregister")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for send channel close")
	}

	hub.Shutdown()
}

func TestWSHub_ShutdownStopsRun(t *testing.T) {
	hub := NewWSHub()
	done := make(chan struct{})
	go func() {
		hub.Run()
		close(done)
	}()

	hub.Shutdown()
	select {
	case <-done:
		// Run returned as expected.
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after Shutdown")
	}
}

func TestNotifyChange_EncodesType(t *testing.T) {
	hub := NewWSHub()
	// No Run loop: read the queued message directly from the buffered channel.
	hub.NotifyChange("file_deleted")
	select {
	case msg := <-hub.broadcast:
		s := string(msg)
		if !strings.Contains(s, "file_deleted") || !strings.Contains(s, "timestamp") {
			t.Errorf("message = %q, want type+timestamp", s)
		}
	case <-time.After(time.Second):
		t.Fatal("no message queued by NotifyChange")
	}
}
