package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

const (
	// APIKeyPrefix is the standard prefix for all ProxyManager API keys
	APIKeyPrefix = "pm_live_"
	// KeyRandomBytesLength generates 24 random bytes (48 hex chars)
	KeyRandomBytesLength = 24
)

// GenerateAPIKey generates a cryptographically secure random API key,
// along with its safe-to-display prefix and SHA-256 hash.
func GenerateAPIKey() (rawKey string, prefix string, hash string, err error) {
	randomBytes := make([]byte, KeyRandomBytesLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", "", "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	randomHex := hex.EncodeToString(randomBytes)
	rawKey = APIKeyPrefix + randomHex
	prefix = APIKeyPrefix + randomHex[:8]
	hash = HashAPIKey(rawKey)
	return rawKey, prefix, hash, nil
}

// HashAPIKey calculates the SHA-256 hash of the provided API key as a hex string
func HashAPIKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}
