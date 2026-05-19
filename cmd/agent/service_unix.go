//go:build !windows
package main

func isWindowsService() bool {
	return false
}

func runService(serverAddr, token string) {
	// No-op on non-windows
}
