package dashboard

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/auth"
)

const aiDocsMarkdown = `# ProxyManager API Guide for AI Agents

Welcome to ProxyManager! This document provides instructions for AI agents, LLMs, and autonomous tools interacting with the ProxyManager platform.

---

> 🌐 **Public Access Note:**
> All documentation endpoints (/llms.txt, /api/v1/docs, /api/v1/ai/docs, /api/v1/openapi.json, /api/v1/ai/ping) are **100% public** and do NOT require an API Key. You can fetch and read these instructions anytime without credentials.

## 1. Authentication for Protected Operations
Operating on agents, tunnels, proxies, domains, or logs requires an API Key. You can pass the API key using either of the following HTTP headers:

Header Option 1 (Recommended):
` + "```http" + `
X-API-Key: pm_live_your_api_key_here
` + "```" + `

Header Option 2:
` + "```http" + `
Authorization: Bearer pm_live_your_api_key_here
` + "```" + `

---

## 2. Fast Health & Connectivity Check
Verify your API key and inspect your permissions:
- **Endpoint:** ` + "`GET /api/v1/ai/ping`" + `
- **Headers:** ` + "`X-API-Key: pm_live_...`" + `
- **Sample Response:**
` + "```json" + `
{
  "status": "ok",
  "authenticated": true,
  "identity": {
    "username": "admin",
    "role": "admin",
    "scopes": "full_access"
  },
  "docs_url": "/api/v1/ai/docs",
  "openapi_url": "/api/v1/openapi.json"
}
` + "```" + `

---

## 3. Core Operational Workflows

### A. Inspect Managed Server Fleet
1. **List all registered agents (machines behind NAT):**
   - **Method:** ` + "`GET /api/v1/agents`" + `
   - Returns array of agents with ` + "`id`" + `, ` + "`hostname`" + `, ` + "`status` (online/offline)" + `, ` + "`hardware_stats` (CPU, RAM, Disk)" + `, and ` + "`open_ports` (listening ports on the agent)" + `.

2. **Get specific agent details:**
   - **Method:** ` + "`GET /api/v1/agents/{id}`" + `

---

### B. Create & Manage FRP Reverse Proxy Tunnels

> **Important Naming Rule:** Proxy names MUST be prefixed with the agent's hostname followed by an underscore: ` + "`<hostname>_<suffix>`" + `.
> Suffix must be lowercase alphanumeric with hyphens (e.g., ` + "`ubuntu-vps_web-app`" + `).

1. **List proxies for an agent:**
   - **Method:** ` + "`GET /api/v1/agents/{id}/proxies`" + `

2. **Create a new HTTP / HTTPS Web Proxy (Domain-based):**
   - **Method:** ` + "`POST /api/v1/proxies`" + `
   - **Content-Type:** ` + "`application/json`" + `
   - **Payload Example:**
` + "```json" + `
{
  "agent_id": "3b2e5917-73d8-4f7b-9c71-081682335f42",
  "name": "node-01_my-app",
  "proxy_type": "http",
  "local_ip": "127.0.0.1",
  "local_port": 3000,
  "custom_domain": "app.example.com",
  "status": "active"
}
` + "```" + `

3. **Create a TCP or UDP Tunnel (Port-based, e.g. SSH, MySQL, Game Server):**
   - **Method:** ` + "`POST /api/v1/proxies`" + `
   - **Payload Example:**
` + "```json" + `
{
  "agent_id": "3b2e5917-73d8-4f7b-9c71-081682335f42",
  "name": "node-01_ssh",
  "proxy_type": "tcp",
  "local_ip": "127.0.0.1",
  "local_port": 22,
  "remote_port": 2222,
  "status": "active"
}
` + "```" + `

4. **Update or Delete a Proxy:**
   - **Update:** ` + "`PUT /api/v1/proxies/{id}`" + `
   - **Delete:** ` + "`DELETE /api/v1/proxies/{id}`" + `

---

### C. Domain Status & Automated SSL
- **Check DNS & SSL status:** ` + "`GET /api/v1/domains/status?domain=app.example.com`" + `
- **Generate Nginx configuration:** ` + "`POST /api/v1/domains/nginx`" + ` with body ` + "`{\"domain\": \"app.example.com\"}`" + `
- **Request Let's Encrypt SSL Cert:** ` + "`POST /api/v1/domains/cert`" + ` with body ` + "`{\"domain\": \"app.example.com\"}`" + `

---

### D. System Telemetry & FRPS Monitoring
- **Hardware telemetry history:** ` + "`GET /api/v1/stats/history/{agent_id}?limit=50`" + `
- **FRPS overall status & active tunnels:** ` + "`GET /api/v1/frps/status`" + `

---

## 4. Error Handling Guidelines
- ` + "`401 Unauthorized`" + `: Missing or invalid API key / token.
- ` + "`409 Conflict`" + `: Duplicate record (proxy name, remote port, or domain is already taken).
- ` + "`400 Bad Request`" + `: Invalid JSON payload or proxy name does not match ` + "`<hostname>_<suffix>`" + ` requirement.
- ` + "`404 Not Found`" + `: Target agent or proxy does not exist.
`

// GetAIDocs provides comprehensive markdown documentation for AI agents
func (h *DashboardHandler) GetAIDocs(c *gin.Context) {
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.String(http.StatusOK, aiDocsMarkdown)
}

// AIPing checks connectivity and authorization for AI Agents
func (h *DashboardHandler) AIPing(c *gin.Context) {
	// Check optional API key in header
	apiKey := c.GetHeader("X-API-Key")
	authHeader := c.GetHeader("Authorization")
	if apiKey == "" && strings.HasPrefix(authHeader, "Bearer pm_live_") {
		apiKey = strings.TrimPrefix(authHeader, "Bearer ")
	}

	if apiKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"status":        "ok",
			"authenticated": false,
			"message":       "ProxyManager AI Gateway ready. Provide X-API-Key header to authenticate.",
			"docs_url":      "/api/v1/ai/docs",
			"openapi_url":   "/api/v1/openapi.json",
		})
		return
	}

	keyHash := auth.HashAPIKey(apiKey)
	var (
		keyID    int
		name     string
		role     string
		scopes   string
		isActive bool
		username string
	)
	err := h.database.QueryRow(`
		SELECT a.id, a.name, a.role, a.scopes, a.is_active, u.username
		FROM api_keys a
		JOIN users u ON a.user_id = u.id
		WHERE a.key_hash = ?
	`, keyHash).Scan(&keyID, &name, &role, &scopes, &isActive, &username)

	if err != nil || !isActive {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":        "error",
			"authenticated": false,
			"error":         "Invalid or inactive API key",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "ok",
		"authenticated": true,
		"identity": gin.H{
			"username": username,
			"key_name": name,
			"role":     role,
			"scopes":   scopes,
		},
		"docs_url":    "/api/v1/ai/docs",
		"openapi_url": "/api/v1/openapi.json",
	})
}

// GetOpenAPISpec returns the OpenAPI 3.0 specification in JSON
func (h *DashboardHandler) GetOpenAPISpec(c *gin.Context) {
	spec := gin.H{
		"openapi": "3.0.3",
		"info": gin.H{
			"title":       "ProxyManager Control Plane API",
			"description": "API for managing FRP reverse proxy tunnels, monitoring fleet health, and remote operations.",
			"version":     "1.0.0",
		},
		"servers": []gin.H{
			{"url": "/api/v1", "description": "Current API Gateway"},
		},
		"components": gin.H{
			"securitySchemes": gin.H{
				"ApiKeyAuth": gin.H{
					"type": "apiKey",
					"in":   "header",
					"name": "X-API-Key",
				},
				"BearerAuth": gin.H{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT / API Key",
				},
			},
		},
		"security": []gin.H{
			{"ApiKeyAuth": []string{}},
			{"BearerAuth": []string{}},
		},
		"paths": gin.H{
			"/ai/ping": gin.H{
				"get": gin.H{
					"summary":     "Ping & Authenticate AI Agent",
					"description": "Verifies credentials and returns user identity with guide links",
					"responses": gin.H{
						"200": gin.H{"description": "Success response"},
					},
				},
			},
			"/ai/docs": gin.H{
				"get": gin.H{
					"summary":     "AI Agent Markdown Documentation",
					"description": "Returns LLM-optimized Markdown instructions for tools and endpoints",
					"responses": gin.H{
						"200": gin.H{"description": "Markdown content"},
					},
				},
			},
			"/agents": gin.H{
				"get": gin.H{
					"summary":     "List all Agents",
					"description": "Returns all registered client agents with hardware stats and open ports",
					"responses": gin.H{
						"200": gin.H{"description": "List of agents"},
					},
				},
			},
			"/agents/{id}": gin.H{
				"get": gin.H{
					"summary": "Get Agent details by ID",
					"parameters": []gin.H{
						{"name": "id", "in": "path", "required": true, "schema": gin.H{"type": "string"}},
					},
					"responses": gin.H{
						"200": gin.H{"description": "Agent details"},
						"404": gin.H{"description": "Agent not found"},
					},
				},
			},
			"/agents/{id}/proxies": gin.H{
				"get": gin.H{
					"summary": "List proxies for a specific agent",
					"parameters": []gin.H{
						{"name": "id", "in": "path", "required": true, "schema": gin.H{"type": "string"}},
					},
					"responses": gin.H{
						"200": gin.H{"description": "List of proxies"},
					},
				},
			},
			"/proxies": gin.H{
				"post": gin.H{
					"summary":     "Create a new proxy tunnel",
					"description": "Creates an HTTP/HTTPS or TCP/UDP proxy tunnel. Name must match <hostname>_<suffix>",
					"requestBody": gin.H{
						"required": true,
						"content": gin.H{
							"application/json": gin.H{
								"schema": gin.H{
									"type": "object",
									"required": []string{
										"agent_id", "name", "proxy_type", "local_port",
									},
									"properties": gin.H{
										"agent_id":      gin.H{"type": "string"},
										"name":          gin.H{"type": "string"},
										"proxy_type":    gin.H{"type": "string", "enum": []string{"http", "https", "tcp", "udp"}},
										"local_ip":      gin.H{"type": "string", "default": "127.0.0.1"},
										"local_port":    gin.H{"type": "integer"},
										"remote_port":   gin.H{"type": "integer", "description": "Required for tcp/udp"},
										"custom_domain": gin.H{"type": "string", "description": "Required for http/https"},
										"status":        gin.H{"type": "string", "default": "active"},
									},
								},
							},
						},
					},
					"responses": gin.H{
						"201": gin.H{"description": "Proxy created successfully"},
						"400": gin.H{"description": "Invalid input format"},
						"409": gin.H{"description": "Proxy name, port or domain conflict"},
					},
				},
			},
			"/proxies/{id}": gin.H{
				"delete": gin.H{
					"summary": "Delete a proxy tunnel",
					"parameters": []gin.H{
						{"name": "id", "in": "path", "required": true, "schema": gin.H{"type": "integer"}},
					},
					"responses": gin.H{
						"200": gin.H{"description": "Proxy deleted"},
					},
				},
			},
			"/domains/status": gin.H{
				"get": gin.H{
					"summary": "Check domain DNS and SSL certificate status",
					"parameters": []gin.H{
						{"name": "domain", "in": "query", "required": true, "schema": gin.H{"type": "string"}},
					},
					"responses": gin.H{
						"200": gin.H{"description": "Domain status information"},
					},
				},
			},
			"/api-keys": gin.H{
				"get": gin.H{
					"summary": "List API keys for current user",
					"responses": gin.H{
						"200": gin.H{"description": "List of API keys"},
					},
				},
				"post": gin.H{
					"summary": "Generate a new API key",
					"requestBody": gin.H{
						"required": true,
						"content": gin.H{
							"application/json": gin.H{
								"schema": gin.H{
									"type": "object",
									"required": []string{
										"name",
									},
									"properties": gin.H{
										"name":            gin.H{"type": "string"},
										"expires_in_days": gin.H{"type": "integer"},
										"role":            gin.H{"type": "string"},
									},
								},
							},
						},
					},
					"responses": gin.H{
						"201": gin.H{"description": "API key generated with plain key string"},
					},
				},
			},
		},
	}

	c.JSON(http.StatusOK, spec)
}
