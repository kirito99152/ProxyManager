package config

import (
	"fmt"
	"os"
	"os/exec"

	"gopkg.in/yaml.v3"
)

const frpsConfigPath = "configs/frps.yaml"

// GetFrpsConfig reads the FRPS configuration file.
func GetFrpsConfig() (map[string]interface{}, error) {
	data, err := os.ReadFile(frpsConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config map[string]interface{}
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to parse yaml: %w", err)
	}

	return config, nil
}

// UpdateFrpsConfig updates the FRPS configuration file and reloads the service.
func UpdateFrpsConfig(newConfig map[string]interface{}) error {
	data, err := yaml.Marshal(&newConfig)
	if err != nil {
		return fmt.Errorf("failed to serialize yaml: %w", err)
	}

	err = os.WriteFile(frpsConfigPath, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	// Attempt to reload or restart FRPS.
	// The exact command depends on Agent #4's systemd setup.
	// For now, we'll try restarting a 'frps' systemd service.
	cmd := exec.Command("systemctl", "restart", "frps")
	if err := cmd.Run(); err != nil {
		// Log the error but don't fail the API request entirely,
		// as the config was saved successfully.
		fmt.Printf("Warning: Failed to restart frps service: %v\n", err)
	}

	return nil
}
