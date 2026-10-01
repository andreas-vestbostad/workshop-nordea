import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createApp } from './app.js'

// Shared .env lives at the repo root (one file for the whole workshop
// project), not inside this workspace - see /.env.example.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '..', '.env') })

const PORT = Number(process.env.PORT ?? 3000)
const app = createApp()

app.listen(PORT, () => {
  console.log(`Wealth Copilot API listening on http://localhost:${PORT}`)
  console.log('All data served by this API is 100% synthetic / fictional.')
  console.log(
    process.env.ANTHROPIC_API_KEY
      ? 'Wealth Copilot: enabled (ANTHROPIC_API_KEY set), answering via Claude + MCP tools.'
      : 'Wealth Copilot: disabled. Set ANTHROPIC_API_KEY in .env to enable POST /customers/:id/copilot.',
  )
})
