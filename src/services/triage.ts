import type { EventBus } from '../bus.js'
import { TOPICS, type Priority, type RequestType } from '../events/types.js'

const RULES: { type: RequestType; re: RegExp }[] = [
  { type: 'outage', re: /\b(site|website)\b[^.!?\n]{0,40}\b(down|offline|not loading|won'?t load|crash(ed)?)\b|\bnot loading\b/i },
  { type: 'dns_email', re: /\b(dns|domain|ssl|certificate|spf|dkim|dmarc)\b|\bemails?\b[^.!?\n]{0,40}\b(bounc\w*|not (working|arriving)|stopped)\b/i },
  { type: 'bug', re: /\b(broken|bug|error|not working|won'?t (submit|save)|fails?)\b/i },
  { type: 'feature', re: /\b(new (page|feature|form)|add (a )?(page|form|section|booking))\b/i },
  { type: 'content', re: /\b(change|update|edit|replace|fix)\b[^.!?\n]{0,50}\b(text|typo|phone|number|address|hours|photo|image|price)\b/i },
  { type: 'seo', re: /\b(seo|google|ranking|keywords?|sitemap)\b/i },
]

const BASE: Record<RequestType, Priority> = { outage: 1, dns_email: 2, bug: 2, content: 3, other: 3, seo: 4, feature: 4 }
export const EFFORT_HOURS: Record<RequestType, number> = { outage: 2, dns_email: 1, bug: 2, content: 1, seo: 3, feature: 8, other: 1 }
const URGENT = /\b(asap|urgent(ly)?|immediately|emergency|today)\b|!{2,}/i

export function classify(message: string): { type: RequestType; priority: Priority } {
  const type = RULES.find((r) => r.re.test(message))?.type ?? 'other'
  let priority = BASE[type]
  if (URGENT.test(message) && priority > 1) priority = (priority - 1) as Priority
  return { type, priority }
}

/** Reads each new request and publishes what kind it is and how urgent. */
export async function startTriage(bus: EventBus) {
  await bus.subscribe(TOPICS.received, async (e) => {
    const { type, priority } = classify(e.message)
    await bus.publish(TOPICS.triaged, e.requestId, { requestId: e.requestId, client: e.client, type, priority, effortHours: EFFORT_HOURS[type] })
  })
}
