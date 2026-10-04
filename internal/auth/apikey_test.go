package auth

import (
	"strings"
	"testing"
)

func TestAPIKeyGenerationAndHashing(t *testing.T) {
	rawKey, prefix, hash, err := GenerateAPIKey()
	if err != nil {
		t.Fatalf("GenerateAPIKey failed: %v", err)
	}

	if !strings.HasPrefix(rawKey, "pm_live_") {
		t.Errorf("Expected rawKey to start with 'pm_live_', got: %s", rawKey)
	}

	if len(rawKey) < 32 {
		t.Errorf("Expected rawKey to be at least 32 chars, got length %d", len(rawKey))
	}

	if !strings.HasPrefix(rawKey, prefix) {
		t.Errorf("Expected rawKey to start with prefix %s, got rawKey: %s", prefix, rawKey)
	}

	computedHash := HashAPIKey(rawKey)
	if computedHash != hash {
		t.Errorf("Expected computed hash %s to match generated hash %s", computedHash, hash)
	}

	// Verify SHA-256 length is 64 hex chars
	if len(hash) != 64 {
		t.Errorf("Expected hash length to be 64 hex chars, got %d", len(hash))
	}
}
