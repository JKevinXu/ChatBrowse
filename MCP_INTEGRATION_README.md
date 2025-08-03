# MCP Client Integration - Real Server Communication

## Overview

A complete MCP (Model Context Protocol) client integration has been implemented in ChatBrowse that communicates with your actual [Shimen Task Design MCP Server](https://github.com/JKevinXu/GameAutomation/blob/main/MCP_Shimen_Task_Design.md) using native messaging and stdio transport.

## Features

✅ **Real MCP Server Communication**: Connects to your actual Python MCP server via native messaging
✅ **One-Click Tool Discovery**: Simply select "MCP Client" from the dropdown to automatically list all available tools  
✅ **Native Messaging Bridge**: Uses Chrome's native messaging to communicate with stdio-based MCP servers
✅ **Runtime Tool Fetching**: Dynamically fetches tools from the running MCP server
✅ **Automatic Categorization**: Intelligently categorizes tools based on their functionality

## Setup Instructions

### 1. Install Native Messaging Host
First, you need to install the native messaging host that bridges the browser extension with your MCP server:

```bash
cd mcp-server
npm install
npm run build
sudo npm run install  # This installs the native messaging host manifest
```

### 2. Start Your MCP Server
Make sure your Shimen Task Design MCP server is running:

```bash
cd /Users/kx/game_automation_project
source venv/bin/activate
python3 mcp_game_automation_server/server.py
```

The server configuration is already set up in `mcp-server/mcp_servers_config.json`:
```json
{
  "game-automation": {
    "command": "/Users/kx/game_automation_project/venv/bin/python3",
    "args": ["/Users/kx/game_automation_project/mcp_game_automation_server/server.py"],
    "description": "Game automation MCP server for automated game interactions"
  }
}
```

## How to Use

### 1. Select MCP Tool
1. Open the ChatBrowse extension popup
2. Click on the tool dropdown (🧰 button)
3. Select "MCP Client" option
4. **The tool list will automatically fetch from your running server!** (One-click behavior)

### 2. View Available Tools

When you select MCP Client, you'll see a categorized list of tools like:

```
🔌 MCP Server Tools (6 available)

Screen Capture:
• capture_screen - Capture screenshot of specified screen region
  Parameters: region, format

Task Automation:
• execute_task - Execute automated game task
  Parameters: task_name, parameters

Task Management:
• get_task_status - Get status of running task
  Parameters: task_id
• list_available_tasks - List all available automation tasks

Screen Analysis:
• analyze_screen - Analyze current screen content using computer vision
  Parameters: analysis_type, region

Action Execution:
• click_element - Click on screen element at specified coordinates
  Parameters: x, y, click_type

💡 Usage: Select MCP tool and type commands like:
• "capture_screen region=game_area"
• "execute_task task_name=daily_login"
• "list_available_tasks"
```

### 3. Manual Tool Listing

You can also manually trigger tool listing by typing any of these when MCP is selected:
- `list tools`
- `list`
- `tools`
- `help`
- (or just press enter with empty input)

### 4. **NEW: Intelligent Agent Mode**

With the new MCP Agent Service, you can now use natural language to automatically select and execute tools:

**Example Commands:**
- `"Run the Shimen task automation"`
- `"Execute daily login automation"`
- `"Start the 师门任务 sequence"`
- `"Help me automate the game tasks"`

**How it works:**
1. 🤖 **AI analyzes** your request
2. 🔍 **Selects** the appropriate MCP tool
3. 📝 **Extracts** parameters from your message
4. ⚡ **Executes** the automation
5. 📊 **Returns** formatted results

## Target MCP Server

This integration is designed for the **Shimen Task Design MCP Server** which provides:

- **Task Automation**: Execute predefined game automation tasks
- **Screen Capture**: Capture screenshots of specific regions
- **Computer Vision**: Analyze screen content using OCR and object detection
- **Action Execution**: Perform clicks and other UI interactions
- **Task Management**: Monitor and control running automation tasks

**Repository**: https://github.com/JKevinXu/GameAutomation/blob/main/MCP_Shimen_Task_Design.md

## Implementation Details

### Architecture

```
Browser Extension → Native Messaging → Native Bridge → MCP Server (stdio)
     ↓                    ↓                ↓              ↓
[mcp-client.ts]  →  [Chrome Native]  →  [native-bridge.ts]  →  [server.py]
```

### Files Modified/Added

1. **`public/popup.html`** - Added MCP dropdown option
2. **`src/popup/popup-ui.ts`** - Added MCP tool selection logic with auto-trigger  
3. **`src/services/mcp-client.ts`** - Real MCP client using native messaging
4. **`src/services/mcp-agent-service.ts`** - **NEW** Intelligent agent for automatic tool selection
5. **`src/services/message-router.ts`** - Added MCP request routing
6. **`mcp-server/src/native-bridge.ts`** - Updated to support game automation server
7. **`mcp-server/src/native-client.ts`** - Added `listTools()` method
8. **`mcp-server/mcp_servers_config.json`** - Configuration for your MCP server

### Key Features

- **Native Messaging**: Uses Chrome's native messaging protocol for secure communication
- **Stdio Transport**: Communicates with MCP servers using JSON-RPC over stdio 
- **Real-time Tool Discovery**: Fetches actual tools from your running MCP server
- **🤖 Intelligent Agent**: AI automatically selects and executes tools based on natural language
- **Multiple Server Support**: Can handle multiple MCP servers simultaneously
- **Auto-Trigger**: Selecting MCP automatically lists tools (one-click)
- **Error Handling**: Graceful fallback if MCP server is unavailable

## Testing

### Prerequisites
1. Make sure your MCP server is running:
   ```bash
   cd /Users/kx/game_automation_project
   source venv/bin/activate
   python3 mcp_game_automation_server/server.py
   ```

2. Install the native messaging host:
   ```bash
   cd mcp-server
   sudo npm run install
   ```

### Test Steps
1. Build and load the extension in Chrome:
   ```bash
   npm run build
   # Load dist/ folder in Chrome extensions (Developer mode)
   ```

2. Open the popup and select "MCP Client" from the dropdown

3. Verify that tools are fetched from your actual MCP server

4. Check the Console logs for native messaging communication:
   - Browser Console: Look for "🔌 MCP:" messages
   - Native Bridge logs: Check system logs for "NATIVE_BRIDGE_LOG:" messages

### Troubleshooting

**Native Messaging Issues:**
- Check Chrome permissions for native messaging
- Verify the native messaging host manifest is installed correctly
- Ensure the Python server is running and accessible

**MCP Server Communication:**
- Check that your MCP server implements the `tools/list` method
- Verify JSON-RPC responses are properly formatted
- Check server logs for error messages

## Integration Complete!

This implementation provides **full real-time communication** with your Shimen Task Design MCP server:

✅ **Native Messaging Bridge** - Secure communication channel established  
✅ **Stdio Transport** - Direct JSON-RPC communication with your Python server  
✅ **Runtime Tool Discovery** - Dynamically fetches actual tools from running server  
✅ **One-Click Integration** - Simple user experience for complex backend communication  

Your ChatBrowse extension now has direct access to all the automation capabilities of your Shimen MCP server! 