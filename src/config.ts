import { InMemoryBus, KafkaBus, type EventBus } from './bus.js'

/** Hours each person can still take this week. */
export const DEFAULT_TEAM = { Priya: 10, Marcus: 6, Aiko: 4 }

/** KAFKA_BROKERS=host:9092 uses Kafka or Redpanda. Without it, everything runs in memory. */
export function makeBus(group: string): EventBus {
  const brokers = process.env.KAFKA_BROKERS
  return brokers ? new KafkaBus(brokers.split(','), group) : new InMemoryBus()
}
