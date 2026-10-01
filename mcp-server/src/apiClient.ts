// Thin fetch wrapper around the Wealth Copilot REST API. The MCP server
// does not read the JSON data files itself - it proxies to a running
// instance of `api/` (see WEALTH_API_URL), so it always reflects the same
// calculations the frontend uses.
const API_BASE_URL = process.env.WEALTH_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(public status: number, public path: string, body: string) {
    super(`Wealth Copilot API request to ${path} failed with ${status}: ${body}`)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const text = await res.text()
  if (!res.ok) throw new ApiError(res.status, path, text)
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

export function listCustomers() {
  return request(`/customers`)
}

export function getCustomer(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}`)
}

export function getAccounts(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/accounts`)
}

export function getTransactions(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/transactions`)
}

export function getInvestments(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/investments`)
}

export function getPortfolio(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/portfolio`)
}

export function getPerformance(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/performance`)
}

export function getRisk(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/risk`)
}

export function getInsights(customerId: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/insights`)
}

export function askCopilot(customerId: string, message: string) {
  return request(`/customers/${encodeURIComponent(customerId)}/copilot`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
