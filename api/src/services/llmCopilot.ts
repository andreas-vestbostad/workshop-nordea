// LLM-backed Wealth Copilot.
//
// Unlike `deterministicCopilot`, this engine delegates to a real Claude
// model. Instead of calling the portfolio/risk/insights services directly,
// it connects to the MCP server in /mcp-server as an MCP client and hands
// Claude that server's tools - the same tools an external MCP client (e.g.
// Claude Desktop) would get. Claude decides which tools to call, with which
// arguments, and synthesizes the final answer.
//
// Requires ANTHROPIC_API_KEY (see /.env.example). The route in
// routes/customers.ts falls back to `deterministicCopilot` if this engine
// is unavailable or throws, so the feature degrades gracefully without a
// key or if the LLM call fails.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { CopilotEngine } from './copilot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// api/src -> api -> repo root -> mcp-server (same depth whether running
// from src via tsx or from dist, mirroring data.ts's DATA_DIR).
const MCP_SERVER_DIR = path.join(__dirname, '..', '..', '..', 'mcp-server')

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const MAX_TOOL_ROUNDS = 6

const SYSTEM_PROMPT = `You are Wealth Copilot, an assistant for a fictional bank's Private Banking customers.
You are currently assisting customer "{customerId}". Whenever a tool takes a "customerId" argument, always pass exactly "{customerId}" - never ask the user for it or guess another one.
Use the provided tools to look up the customer's real data before answering; never invent numbers.
Keep answers short (2-4 sentences) and in plain language, avoiding financial jargon.
All data is synthetic/fictional and this is an educational demo, not real investment advice - say so only when directly relevant (e.g. questions about risk or recommendations).`

// The MCP server is spawned once (lazily, on first use) and the connection
// is reused across requests - spawning a fresh process per chat message
// would add noticeable latency.
let mcpClientPromise: Promise<Client> | null = null

function getMcpClient(): Promise<Client> {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['tsx', 'src/index.ts'],
        cwd: MCP_SERVER_DIR,
        env: {
          ...process.env,
          WEALTH_API_URL: process.env.WEALTH_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
        },
      })
      const client = new Client({ name: 'wealth-copilot-api', version: '1.0.0' })
      await client.connect(transport)
      return client
    })()
    // Don't cache a failed connection attempt - let the next request retry.
    mcpClientPromise.catch(() => {
      mcpClientPromise = null
    })
  }
  return mcpClientPromise
}

function toolResultText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => (block && typeof block === 'object' && 'text' in block ? String((block as { text: unknown }).text) : ''))
    .join('\n')
}

export const llmCopilot: CopilotEngine = {
  async answer(customerId, message) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const anthropic = new Anthropic({ apiKey })
    const client = await getMcpClient()
    const { tools } = await client.listTools()
    const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    }))

    const system = SYSTEM_PROMPT.replaceAll('{customerId}', customerId)
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: message }]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: anthropicTools,
        messages,
      })

      if (response.stop_reason !== 'tool_use') {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim()
        return { answer: text || "I couldn't come up with an answer for that.", matched_intent: 'llm' }
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        try {
          const result = await client.callTool({ name: block.name, arguments: block.input as Record<string, unknown> })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: toolResultText(result.content) || JSON.stringify(result),
            is_error: Boolean(result.isError),
          })
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: error instanceof Error ? error.message : String(error),
            is_error: true,
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }

    return {
      answer: "I wasn't able to finish looking that up - could you try rephrasing your question?",
      matched_intent: 'llm-incomplete',
    }
  },
}
