#!/usr/bin/env node
// MCP server for the Wealth Copilot workshop demo.
//
// Wraps the customer-facing endpoints of `api/` (see ../../api/src/routes)
// as MCP tools, so an MCP-compatible client (an AI assistant, an agent
// framework, etc.) can look up a fictional customer's accounts, portfolio,
// performance, risk and insights, and ask the deterministic Copilot a
// question - without the client needing to know the REST API shape.
//
// Requires a running instance of the API (`npm run dev:api` from the repo
// root). Point this server at a different instance via WEALTH_API_URL.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as api from './apiClient.js'

const server = new McpServer({
  name: 'wealth-copilot',
  version: '1.0.0',
})

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

const customerIdShape = { customerId: z.string().describe('Customer ID, e.g. "cust_001" (see list_customers)') }

server.tool(
  'list_customers',
  'List all fictional customers with their basic profile (name, age, country, risk profile, investment horizon, income).',
  {},
  async () => {
    try {
      return jsonResult(await api.listCustomers())
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_customer',
  "Get a single customer's profile.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getCustomer(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_accounts',
  "Get a customer's accounts (current, savings, investment, pension) with balances.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getAccounts(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_transactions',
  "Get a customer's account transactions (income, expenses, transfers).",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getTransactions(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_investments',
  "Get a customer's raw investment positions (ticker, quantity, purchase/current price, sector, geography).",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getInvestments(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_portfolio',
  "Get a customer's computed portfolio summary: total value, cash %, gain/loss, allocation by asset type/geography/sector, and largest holdings.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getPortfolio(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_performance',
  "Get a customer's illustrative historical portfolio value series and period return %. Note: this replays today's holdings against historical prices, so it reflects price movement only, not actual past buy/sell activity.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getPerformance(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_risk',
  "Get a customer's illustrative demo risk score and category, and whether it aligns with their stated risk profile. Educational model only, not a real suitability assessment.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getRisk(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'get_insights',
  "Get a customer's deterministic, rule-based insights (concentration, risk mismatch, cash allocation, performance changes) and monthly savings rate.",
  customerIdShape,
  async ({ customerId }) => {
    try {
      return jsonResult(await api.getInsights(customerId))
    } catch (error) {
      return errorResult(error)
    }
  },
)

server.tool(
  'ask_copilot',
  "Ask the Wealth Copilot a natural-language question about a customer's finances (performance, risk, diversification, savings, largest risks). Answers are deterministic, derived from the customer's own data.",
  {
    ...customerIdShape,
    message: z.string().describe('Natural-language question, e.g. "How has my portfolio performed?"'),
  },
  async ({ customerId, message }) => {
    try {
      return jsonResult(await api.askCopilot(customerId, message))
    } catch (error) {
      return errorResult(error)
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
