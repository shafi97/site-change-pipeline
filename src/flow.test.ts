import { describe, expect, it } from 'vitest'
import { graphql } from 'graphql'
import { InMemoryBus } from './bus.js'
import { buildSchema } from './graphql.js'
import { startCapacity } from './services/capacity.js'
import { startIntake, validateInput } from './services/intake.js'
import { startNotifications } from './services/notifications.js'
import { classify, startTriage } from './services/triage.js'

async function setup(team: Record<string, number> = { Priya: 4, Marcus: 2 }) {
  const bus = new InMemoryBus()
  await startTriage(bus)
  const cap = await startCapacity(bus, { ...team })
  const notes = await startNotifications(bus, () => {})
  const intake = await startIntake(bus)
  return { bus, cap, notes, intake }
}

describe('classification', () => {
  it('finds the type and bumps urgent requests one level', () => {
    expect(classify('Our website is down')).toEqual({ type: 'outage', priority: 1 })
    expect(classify('Please change the phone number')).toEqual({ type: 'content', priority: 3 })
    expect(classify('Please change the phone number asap')).toEqual({ type: 'content', priority: 2 })
    expect(classify('Thanks for last month')).toEqual({ type: 'other', priority: 3 })
  })
})

describe('request flow across four services', () => {
  it('triages, assigns to the person with most room, and notifies', async () => {
    const { bus, cap, notes, intake } = await setup()
    const r = await intake.submit({ client: 'Maple Dental', message: 'Emails to our domain are bouncing back' })
    expect(r.status).toBe('received')
    await bus.idle()
    expect(intake.requests.get(r.id)).toMatchObject({ status: 'assigned', type: 'dns_email', priority: 2, assignee: 'Priya' })
    expect(cap.team.Priya).toBe(3) // dns_email costs 1 hour
    expect(notes.sent).toHaveLength(1)
    expect(notes.sent[0].message).toContain('Priya is on your request')
  })

  it('spreads work: the next request goes to whoever now has the most room', async () => {
    const { bus, intake } = await setup({ Priya: 2, Marcus: 2 })
    const a = await intake.submit({ client: 'A', message: 'Our website is down right now' }) // outage, 2h
    await bus.idle()
    const b = await intake.submit({ client: 'B', message: 'The contact form is broken, it will not submit' }) // bug, 2h
    await bus.idle()
    const names = [intake.requests.get(a.id)!.assignee, intake.requests.get(b.id)!.assignee]
    expect(new Set(names).size).toBe(2)
  })

  it('queues a request when nobody has enough room and tells the client', async () => {
    const { bus, cap, notes, intake } = await setup({ Priya: 3 })
    const r = await intake.submit({ client: 'Lakeview', message: 'We want to add a new page with class booking' }) // feature, 8h
    await bus.idle()
    expect(intake.requests.get(r.id)).toMatchObject({ status: 'queued', reason: 'no_capacity' })
    expect(cap.team.Priya).toBe(3) // nothing reserved
    expect(notes.sent[0].message).toMatch(/in the queue/)
  })

  it('does not over-assign when two requests race for the last hours', async () => {
    const { bus, cap, intake } = await setup({ Priya: 2 })
    const [a, b] = await Promise.all([
      intake.submit({ client: 'A', message: 'Our website is down, please help' }),
      intake.submit({ client: 'B', message: 'The site is not loading at all' }),
    ])
    await bus.idle()
    const statuses = [intake.requests.get(a.id)!.status, intake.requests.get(b.id)!.status].sort()
    expect(statuses).toEqual(['assigned', 'queued'])
    expect(cap.team.Priya).toBe(0)
  })

  it('never moves a status backwards when events arrive out of order', async () => {
    const bus = new InMemoryBus()
    const intake = await startIntake(bus)
    const r = await intake.submit({ client: 'A', message: 'Please change the phone number' })
    await bus.publish('requests.assigned', r.id, { requestId: r.id, assignee: 'Priya', effortHours: 1 })
    await bus.idle()
    await bus.publish('requests.triaged', r.id, { requestId: r.id, client: 'A', type: 'content', priority: 3, effortHours: 1 })
    await bus.idle()
    expect(intake.requests.get(r.id)).toMatchObject({ status: 'assigned', type: 'content', priority: 3 })
  })
})

describe('input rules', () => {
  it('rejects bad input', () => {
    expect(() => validateInput({ client: ' ', message: 'a long enough message' })).toThrow()
    expect(() => validateInput({ client: 'A', message: 'short' })).toThrow()
    expect(() => validateInput({ client: 'A', message: 'x'.repeat(5001) })).toThrow()
  })
})

describe('GraphQL API', () => {
  it('submits a request and reads it back by status', async () => {
    const { bus, intake } = await setup()
    const schema = buildSchema(intake)
    const sent = await graphql({ schema, source: 'mutation { submitRequest(client: "Dee", message: "Please update our opening hours") { id status } }' })
    expect(sent.errors).toBeUndefined()
    await bus.idle()
    const read = await graphql({ schema, source: '{ requests(status: "assigned") { client type priority assignee } }' })
    expect(read.data).toEqual({ requests: [{ client: 'Dee', type: 'content', priority: 3, assignee: 'Priya' }] })
  })

  it('returns a clear error for bad input', async () => {
    const { intake } = await setup()
    const res = await graphql({ schema: buildSchema(intake), source: 'mutation { submitRequest(client: "", message: "Please update our hours") { id } }' })
    expect(res.errors?.[0].message).toMatch(/client is required/)
    expect(res.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT')
  })
})
