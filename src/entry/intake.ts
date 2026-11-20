import { buildSchema } from '../graphql.js'
import { startHttp } from '../http.js'
import { makeBus } from '../config.js'
import { startIntake } from '../services/intake.js'

const service = await startIntake(makeBus('intake-service'))
await startHttp(buildSchema(service), Number(process.env.PORT ?? 4000))
console.log('intake service: GraphQL on /graphql')
