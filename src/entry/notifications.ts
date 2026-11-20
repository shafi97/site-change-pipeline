import { makeBus } from '../config.js'
import { startNotifications } from '../services/notifications.js'

await startNotifications(makeBus('notifications-service'))
console.log('notifications service: listening')
