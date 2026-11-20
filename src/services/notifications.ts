import type { EventBus } from '../bus.js'
import { TOPICS } from '../events/types.js'

export interface Notification { requestId: string; to: string; message: string }

/** Tells the client what happened. Here it records and logs the message instead of sending an email. */
export async function startNotifications(bus: EventBus, log: (line: string) => void = console.log) {
  const sent: Notification[] = []
  await bus.subscribe(TOPICS.status, (e) => {
    if (e.status !== 'assigned' && e.status !== 'queued') return
    const message =
      e.status === 'assigned'
        ? `Hi ${e.client}, ${e.assignee} is on your request${e.priority === 1 ? ' as a top priority' : ''}.`
        : `Hi ${e.client}, we have your request and it is in the queue. We will assign it as soon as someone has room.`
    sent.push({ requestId: e.requestId, to: e.client, message })
    log(`[notify] ${e.requestId}: ${message}`)
  })
  return { sent }
}
