import { randomUUID } from 'node:crypto'
import type { EventBus } from '../bus.js'
import { TOPICS, type Priority, type RequestStatus, type RequestType } from '../events/types.js'

export interface ChangeRequest {
  id: string
  client: string
  message: string
  status: RequestStatus
  type?: RequestType
  priority?: Priority
  assignee?: string
  reason?: string
}

export interface SubmitInput { client: string; message: string }

export class InputError extends Error {}

export function validateInput(input: SubmitInput): void {
  if (!input.client.trim()) throw new InputError('client is required')
  if (input.message.trim().length < 10) throw new InputError('message must be at least 10 characters')
  if (input.message.length > 5000) throw new InputError('message must be at most 5000 characters')
}

/** Owns request records. Publishes requests.received and keeps status up to date from the other services' events. */
export async function startIntake(bus: EventBus) {
  const requests = new Map<string, ChangeRequest>()

  // Events from different topics can arrive out of order on a real broker, so a status never moves backwards.
  const RANK: Record<RequestStatus, number> = { received: 0, triaged: 1, assigned: 2, queued: 2 }

  async function update(id: string, patch: Partial<ChangeRequest>) {
    const r = requests.get(id)
    if (!r) return
    const { status, ...details } = patch
    Object.assign(r, details)
    if (status && RANK[status] >= RANK[r.status]) r.status = status
    await bus.publish(TOPICS.status, id, { requestId: id, client: r.client, status: r.status, priority: r.priority, assignee: r.assignee, reason: r.reason })
  }

  await bus.subscribe(TOPICS.triaged, (e) => update(e.requestId, { status: 'triaged', type: e.type, priority: e.priority }))
  await bus.subscribe(TOPICS.assigned, (e) => update(e.requestId, { status: 'assigned', assignee: e.assignee }))
  await bus.subscribe(TOPICS.queued, (e) => update(e.requestId, { status: 'queued', reason: e.reason }))

  return {
    requests,
    async submit(input: SubmitInput): Promise<ChangeRequest> {
      validateInput(input)
      const r: ChangeRequest = { id: randomUUID(), client: input.client.trim(), message: input.message.trim(), status: 'received' }
      requests.set(r.id, r)
      const snapshot = { ...r }
      await bus.publish(TOPICS.received, r.id, { requestId: r.id, client: r.client, message: r.message })
      return snapshot
    },
  }
}

export type IntakeService = Awaited<ReturnType<typeof startIntake>>
