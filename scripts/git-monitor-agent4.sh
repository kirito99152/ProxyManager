#!/bin/bash
# Agent #4 Git Monitoring Script
# This script pulls changes and exits when a new commit is detected.

LAST_HASH=$(git rev-parse HEAD)
INTERVAL=15
MAX_INTERVAL=120
echo "Monitoring started. Current hash: $LAST_HASH"

while true; do
  git fetch origin main > /dev/null 2>&1
  NEW_HASH=$(git rev-parse origin/main)
  
  if [ "$LAST_HASH" != "$NEW_HASH" ]; then
    echo "CHANGE_DETECTED"
    git pull origin main
    echo "New Commit: $NEW_HASH"
    git log -1 --pretty=format:"%s%n%b"
    exit 0
  fi
  
  sleep $INTERVAL
  # Increase interval gradually
  if [ $INTERVAL -lt $MAX_INTERVAL ]; then
    INTERVAL=$((INTERVAL + 15))
  fi
  
  # Safety break for the session environment (approx 5 mins max)
  # This prevents the tool call from hanging indefinitely if no one commits.
  # The agent will restart this if needed.
  TIME_ELAPSED=$((TIME_ELAPSED + INTERVAL))
  if [ $TIME_ELAPSED -gt 300 ]; then
    echo "TIMEOUT_RESTARTING"
    exit 1
  fi
done
