#!/bin/bash

# Signal monitor script for Agent #3
# It pulls the latest changes and checks for the signal from Agent #1

SLEEP_INTERVAL=60
MAX_SLEEP=1800 # 30 mins

echo "Agent #3: Starting signal monitor..."

while true; do
  echo "Pulling latest changes..."
  git pull origin main --rebase
  
  # Check if Agent #1 signaled completion in git log (last 5 commits)
  if git log -n 5 | grep -qi "PROJECT COMPLETED"; then
    echo "Agent #1 signaled completion! Stopping monitor."
    break
  fi
  
  # Check if Agent #1 added a specific signal file or updated TASKS.md
  if grep -qi "PROJECT COMPLETED" TASKS.md 2>/dev/null; then
    echo "Agent #1 signaled completion in TASKS.md! Stopping monitor."
    break
  fi

  echo "Sleeping for $SLEEP_INTERVAL seconds..."
  sleep $SLEEP_INTERVAL
  
  # Increase sleep interval gradually (linear increase)
  SLEEP_INTERVAL=$((SLEEP_INTERVAL + 60))
  if [ $SLEEP_INTERVAL -gt $MAX_SLEEP ]; then
    SLEEP_INTERVAL=$MAX_SLEEP
  fi
done
