import { DEFAULT_TEAM, makeBus } from '../config.js'
import { startCapacity } from '../services/capacity.js'

await startCapacity(makeBus('capacity-service'), { ...DEFAULT_TEAM })
console.log('capacity service: listening')
