// Runs all four services in one process on the in-memory bus. Handy for a quick local try-out.
import { InMemoryBus } from '../bus.js'
import { DEFAULT_TEAM } from '../config.js'
import { buildSchema } from '../graphql.js'
import { startHttp } from '../http.js'
import { startCapacity } from '../services/capacity.js'
import { startIntake } from '../services/intake.js'
import { startNotifications } from '../services/notifications.js'
import { startTriage } from '../services/triage.js'

const bus = new InMemoryBus()
await startTriage(bus)
await startCapacity(bus, { ...DEFAULT_TEAM })
await startNotifications(bus)
const intake = await startIntake(bus)
await startHttp(buildSchema(intake), Number(process.env.PORT ?? 4000))
console.log('All services running in one process. POST to http://localhost:4000/graphql')
