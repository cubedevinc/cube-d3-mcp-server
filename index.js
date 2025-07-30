#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export class CubeD3MCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "cube-d3-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Configuration for Cube API - these should be provided via environment variables
    this.cubeConfig = {
      baseUrl: "https://ai-engineer.cubecloud.dev",
      tenantName: process.env.CUBE_TENANT_NAME,
      agentId: process.env.CUBE_AGENT_ID,
      secret: process.env.CUBE_API_KEY, // From Admin → Agents → API Key
    };

    this.setupHandlers();
  }

  // Generate JWT token for Cube API authentication
  generateJWT() {
    if (!this.cubeConfig.secret) {
      throw new Error("Cube API key not configured. Set CUBE_API_KEY environment variable.");
    }

    if (!this.cubeConfig.tenantName) {
      throw new Error("Cube tenant name not configured. Set CUBE_TENANT_NAME environment variable.");
    }

    if (!this.cubeConfig.agentId) {
      throw new Error("Cube agent ID not configured. Set CUBE_AGENT_ID environment variable.");
    }

    const payload = {
      iss: 'mcp-server',
      aud: 'ai-engineer',
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    };

    return jwt.sign(payload, this.cubeConfig.secret);
  }

  // Stream chat with Cube AI agent
  async streamCubeChat(chatId, input) {
    const token = this.generateJWT();
    const url = `${this.cubeConfig.baseUrl}/api/v1/public/${this.cubeConfig.tenantName}/agents/${this.cubeConfig.agentId}/chat/stream-chat-state`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        chatId,
        input
      })
    });

    if (!response.ok) {
      throw new Error(`Cube API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  setupHandlers() {
    // Handle initialization
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: "cube-d3-mcp-server",
          version: "1.0.0",
        },
      };
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "chat",
          description: "Chat with Cube AI agent for analytics and data exploration. Returns streaming response with AI insights, tool calls, and data visualizations.",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Your question or request for the Cube AI agent (e.g., 'Show me revenue trends for the last 6 months')",
              },
              chatId: {
                type: "string",
                description: "Unique chat session ID (optional, will be generated if not provided)",
              },
            },
            required: ["message"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "chat":
          try {
            const chatId = args.chatId || `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const response = await this.streamCubeChat(chatId, args.message);
            
            let streamContent = "";
            let allMessages = [];
            
            // Read the streaming response using Node.js streams
            let buffer = "";
            
            for await (const chunk of response.body) {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              
              // Keep the last incomplete line in buffer
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const message = JSON.parse(line);
                    allMessages.push(message);
                    
                    // Accumulate assistant content
                    if (message.role === 'assistant' && message.content && !message.isDelta) {
                      streamContent += message.content + '\n';
                    }
                    
                    // Add tool call information
                    if (message.toolCall) {
                      const toolInfo = `\n🔧 Tool Call: ${message.toolCall.name}`;
                      if (message.toolCall.result) {
                        streamContent += `${toolInfo} - Completed\n`;
                      } else {
                        streamContent += `${toolInfo} - In Progress\n`;
                      }
                    }
                  } catch (parseError) {
                    console.error('Failed to parse message:', parseError, 'Line:', line);
                  }
                }
              }
            }
            
            // Process any remaining buffer content
            if (buffer.trim()) {
              try {
                const message = JSON.parse(buffer);
                allMessages.push(message);
                if (message.role === 'assistant' && message.content && !message.isDelta) {
                  streamContent += message.content + '\n';
                }
              } catch (parseError) {
                console.error('Failed to parse final message:', parseError);
              }
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: streamContent || "Chat completed with no visible content",
                },
                {
                  type: "text",
                  text: `\n\n📊 **Cube D3 Chat Session Complete**\nChat ID: ${chatId}\nTotal messages processed: ${allMessages.length}`,
                },
              ],
            };
            
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ Error calling Cube API: ${error.message}\n\nPlease ensure your environment variables are set:\n- CUBE_API_KEY: Your API key from Admin → Agents → API Key\n- CUBE_TENANT_NAME: Your tenant name (default: "cloud")\n- CUBE_AGENT_ID: Your agent ID (default: "2")`,
                },
              ],
            };
          }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "info://server",
          mimeType: "text/plain",
          name: "Server Information",
          description: "Basic information about this MCP server",
        },
        {
          uri: "config://example",
          mimeType: "application/json",
          name: "Example Configuration",
          description: "Example configuration data",
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case "info://server":
          return {
            contents: [
              {
                uri,
                mimeType: "text/plain",
                text: "Cube D3 MCP Server\\nVersion: 1.0.0\\nCreated for Cube.js enterprise examples\\n\\nThis server provides chat functionality for analytics and data exploration with Cube AI.",
              },
            ],
          };

        case "config://example":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify({
                  serverName: "cube-d3-mcp-server",
                  version: "1.0.0",
                  features: ["chat"],
                  description: "A Cube D3 MCP server for analytics and data exploration",
                }, null, 2),
              },
            ],
          };

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Cube D3 MCP Server running on stdio");
  }
}

// Start the server
const server = new CubeD3MCPServer();
server.run().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});