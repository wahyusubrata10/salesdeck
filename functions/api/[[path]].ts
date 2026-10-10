import { handle, type Env } from '../../server/api'

export const onRequest = (ctx: { request: Request; env: Env }) => handle(ctx.request, ctx.env)
