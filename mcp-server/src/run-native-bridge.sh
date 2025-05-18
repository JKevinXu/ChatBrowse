#!/bin/sh
# This script will be copied to the dist directory.
# DIR will be the absolute path to the dist directory where this script runs.
DIR=$(cd "$(dirname "$0")" && pwd)
LOG_FILE="/tmp/chatbrowse_native_host.log"

echo "NATIVE_WRAPPER_LOG: run-native-bridge.sh started at $(date)" >> "$LOG_FILE"
echo "NATIVE_WRAPPER_LOG: DIR is $DIR" >> "$LOG_FILE"

# Attempt to find node.
# NODE_EXEC=$(which node) # Original logic commented out
NODE_EXEC="/opt/homebrew/bin/node" # Hardcoded path
echo "NATIVE_WRAPPER_LOG: NODE_EXEC is $NODE_EXEC" >> "$LOG_FILE"

# Check if the found NODE_EXEC is valid and executable
# We still keep this check, primarily for the -x (executable) part.
if ! [ -x "$NODE_EXEC" ]; then 
    echo "NATIVE_WRAPPER_ERROR: Node executable at $NODE_EXEC is not executable or not found." >> "$LOG_FILE" # Log to file
    echo "NATIVE_WRAPPER_ERROR: Node executable at $NODE_EXEC is not executable or not found." >&2 # Also to stderr for Chrome
    exit 1
fi
echo "NATIVE_WRAPPER_LOG: NODE_EXEC check passed." >> "$LOG_FILE"

# No longer need the extensive fallback logic if we hardcode the path and check it.
# if ! command -v "$NODE_EXEC" >/dev/null 2>&1 || ! [ -x "$NODE_EXEC" ]; then
#     # Fallback common locations for macOS
#     if [ -x "/usr/local/bin/node" ]; then
#         NODE_EXEC="/usr/local/bin/node"
#     elif [ -x "/opt/homebrew/bin/node" ]; then # Apple Silicon Homebrew
#         NODE_EXEC="/opt/homebrew/bin/node"
#     else
#         # If node still not found, log and exit
#         # This log might go to a place Chrome can see or a system log
#         echo "NATIVE_WRAPPER_ERROR: node command not found via 'which' or common paths." >&2
#         exit 1
#     fi
# fi

echo "NATIVE_WRAPPER_LOG: About to exec $NODE_EXEC $DIR/native-bridge.js (stdout/stderr will now go to Chrome)" >> "$LOG_FILE"
# IMPORTANT: The stdout of native-bridge.js MUST go to Chrome for native messaging.
# Stderr from native-bridge.js will be available to Chrome.
exec "$NODE_EXEC" "$DIR/native-bridge.js" "$@"

# This line should not be reached if exec is successful.
echo "NATIVE_WRAPPER_LOG: EXEC FAILED for $NODE_EXEC $DIR/native-bridge.js" >> "$LOG_FILE" 