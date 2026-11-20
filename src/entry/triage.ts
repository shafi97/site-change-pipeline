import { makeBus } from '../config.js'
import { startTriage } from '../services/triage.js'

await startTriage(makeBus('triage-service'))
console.log('triage service: listening')
