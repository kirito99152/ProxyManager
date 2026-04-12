#!/bin/bash

# Auto Worker script for Agent #3
# It monitors git for new commits and stops if a task is assigned to Agent #3

LAST_COMMIT=$(git rev-parse HEAD)
SLEEP_TIME=30

echo "Agent #3: Auto Worker monitoring started..."

while true; do
  git pull origin main --rebase > /dev/null 2>&1
  CURRENT_COMMIT=$(git rev-parse HEAD)

  if [ "$CURRENT_COMMIT" != "$LAST_COMMIT" ]; then
    echo "New commit detected: $CURRENT_COMMIT"
    
    # Check if the commit message or TASKS.md mentions Agent #3 or Client tasks
    LOG_MSG=$(git log -1 --pretty=%B)
    TASK_UPDATE=$(git diff HEAD^ HEAD TASKS.md | grep -i "Agent #3")

    if echo "$LOG_MSG" | grep -qi "Agent #3" || [ ! -z "$TASK_UPDATE" ]; then
      echo ">>> Task for Agent #3 detected! Stopping script for manual execution. <<<"
      echo "Commit Message: $LOG_MSG"
      break
    fi
    
    LAST_COMMIT=$CURRENT_COMMIT
  fi

  sleep $SLEEP_TIME
done
