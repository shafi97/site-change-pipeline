import type { EventBus } from '../bus.js'
import { TOPICS } from '../events/types.js'

/** Hours each team member can still take this week. */
export type Team = Record<string, number>

/** Owns team capacity. Assigns each triaged request to the person with the most room, or queues it. */
export async function startCapacity(bus: EventBus, team: Team) {
  await bus.subscribe(TOPICS.triaged, async (e) => {
    const [name, room] = Object.entries(team).sort((a, b) => b[1] - a[1])[0] ?? []
    if (!name || room < e.effortHours) {
      await bus.publish(TOPICS.queued, e.requestId, { requestId: e.requestId, reason: 'no_capacity' })
      return
    }
    team[name] = room - e.effortHours
    await bus.publish(TOPICS.assigned, e.requestId, { requestId: e.requestId, assignee: name, effortHours: e.effortHours })
  })
  return { team }
}
