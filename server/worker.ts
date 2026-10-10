// Entry point Cloudflare Workers: /api/* ke API sinkron, selain itu file website (dist/).
import { handle, type Env } from './api'

interface WorkerEnv extends Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/')) return handle(request, env)
    return env.ASSETS.fetch(request)
  },
}
