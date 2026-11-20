import { createServer, type Server } from 'node:http'
import { graphql, type GraphQLSchema } from 'graphql'

/** Tiny HTTP wrapper: POST /graphql with { query, variables }. GET /health for container checks. */
export function startHttp(schema: GraphQLSchema, port: number): Promise<Server> {
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200).end('ok'); return }
    if (req.method === 'POST' && req.url === '/graphql') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 100_000) { res.writeHead(413).end(); return }
      }
      try {
        const { query, variables } = JSON.parse(body) as { query: string; variables?: Record<string, unknown> }
        const result = await graphql({ schema, source: query, variableValues: variables })
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result))
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ errors: [{ message: 'Bad request' }] }))
      }
      return
    }
    res.writeHead(404).end()
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}
