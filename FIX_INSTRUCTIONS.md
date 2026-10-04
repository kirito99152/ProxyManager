## ProxyManager Agent Windows Setup Fix (Root Cause & Solution)

### Problem Description
You were facing two related errors:
1.  **Invalid Install Token:** When generating a one-time install link, the URL was created using the domain `proxy.ovncr.vn`. This failed because that domain was no longer pointing to your server.
2.  **Service Start Failure:** The agent, after being installed, would also fail to start because it was trying to connect to the same incorrect `proxy.ovncr.vn` address.

Both errors happened because the server was dynamically generating installation scripts and configurations based on the `Host` header of the request used to access the dashboard.

### Solution
I have addressed the root cause of this issue. The server logic has been updated to prioritize a stable server IP address over the dynamic `Host` header.

1.  **Code Changes:** The server code in `internal/dashboard/handlers.go` was modified. The functions that generate URLs for the agent installation now use the `SERVER_IP` environment variable. If this variable is set, it will be used as the base for all generated URLs.

2.  **Server Rebuilt:** I have rebuilt the server binary (`bin/server`) with these changes.

### Action Required
To ensure the fix works correctly, you must **start the server with the `SERVER_IP` environment variable set** to your server's public IP address.

**Example:**
```bash
export SERVER_IP="59.153.245.146"
./bin/server
```

By setting this environment variable, all automatically generated installation scripts and agent configurations will now correctly point to `59.153.245.146`, and both of the errors you were seeing should be resolved.

You can now go to the dashboard, generate a new one-time installation command, and it will work correctly.
