# Cube D3 MCP Server

A Model Context Protocol (MCP) server that provides chat functionality with Cube's AI agent for analytics and data exploration.

## Features

This MCP server provides:

### Tools
- **chat**: Chat with Cube AI agent for analytics and data exploration (streams real-time responses)

## MCP Client Configuration

### Cursor or Claude Desktop Configuration

For Cursor and Claude Desktop, add this to your MCP settings:

```json
{
  "mcpServers": {
    "cube-d3-mcp-server": {
      "command": "npx",
      "args": ["cube-d3-mcp-server"],
      "env": {
        "CUBE_API_KEY": "your_api_key_here",
        "CUBE_TENANT_NAME": "your_tenant_name",
        "CUBE_AGENT_ID": "your_agent_id"
      }
    }
  }
}
```

#### Obtaining Credentials 

* CUBE_API_KEY - Navigate to **Admin -> Agent -> Click on Agent -> Enable API Key**.
* CUBE_TENANT_NAME - Your tenant name from the URL, e.g. 'acme' in https://acme.cubecloud.dev
* CUBE_AGENT_ID - Navigate to **Admin -> Agent -> Click on Agent** to find it.

## Cube Chat Examples

Ask questions like "Show me revenue trends" or "What are our top products?" to get real-time analytics responses with data visualizations and SQL queries.

## Architecture

Standard MCP server with tools, resources, and stdio transport. Integrates with Cube's streaming chat API using JWT authentication and tracks AI tool usage. Built with `@modelcontextprotocol/sdk`.
