package dashboard

import (
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestBuildLinuxInstallScript_UnboundVariable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "https://proxy.ovncr.vn/api/v1/install/script?os=linux", nil)
	c.Request = req

	// A realistic bcrypt hash starting with $2a$12$...
	recoveryHash := "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	agentToken := "p0azP64tthQJeZl_UNO6kVnO810rhYBZY6AE0TBB08s"

	script := buildLinuxInstallScript(c, installNetworkSettings{}, agentToken, recoveryHash)

	// Check the first 15 lines of the generated bash script (variable assignments)
	lines := strings.Split(script, "\n")
	if len(lines) > 15 {
		lines = lines[:15]
	}
	headerScript := strings.Join(lines, "\n") + "\n" + `printf "%s" "$RECOVERY_HASH"`

	// Execute through bash with set -euo pipefail
	cmd := exec.Command("bash", "-c", headerScript)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Bash execution failed: %v, output: %s", err, string(out))
	}

	if string(out) != recoveryHash {
		t.Errorf("Expected RECOVERY_HASH to be %q, got %q", recoveryHash, string(out))
	}

	// Also verify full script passes bash syntax check
	cmdSyntax := exec.Command("bash", "-n")
	cmdSyntax.Stdin = strings.NewReader(script)
	syntaxOut, err := cmdSyntax.CombinedOutput()
	if err != nil {
		t.Fatalf("Bash syntax check failed on full script: %v, output: %s", err, string(syntaxOut))
	}
}

func TestBuildWindowsInstallScript_PreservesHash(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "https://proxy.ovncr.vn/api/v1/install/script?os=windows", nil)
	c.Request = req

	recoveryHash := "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	agentToken := "p0azP64tthQJeZl_UNO6kVnO810rhYBZY6AE0TBB08s"

	script := buildWindowsInstallScript(c, installNetworkSettings{}, agentToken, recoveryHash)

	// PowerShell must not use double quotes around $RecoveryHash because $2a would be evaluated as a variable
	if strings.Contains(script, `$RecoveryHash = "`+recoveryHash+`"`) {
		t.Errorf("PowerShell script should not double-quote $RecoveryHash because $2a expands as a variable")
	}
	expectedAssignment := `$RecoveryHash = '` + recoveryHash + `'`
	if !strings.Contains(script, expectedAssignment) {
		t.Errorf("Expected PowerShell script to contain %q, but it did not", expectedAssignment)
	}
}
