import { Kafka, logLevel } from 'kafkajs'
import type { EventMap, Topic } from './events/types.js'

export type Handler<T extends Topic> = (event: EventMap[T]) => void | Promise<void>

/** The only thing services know about messaging. Swap the implementation, keep the services. */
export interface EventBus {
  publish<T extends Topic>(topic: T, key: string, event: EventMap[T]): Promise<void>
  subscribe<T extends Topic>(topic: T, handler: Handler<T>): Promise<void>
  close(): Promise<void>
}

/** Runs everything in one process. Used by tests and the single-process dev mode. */
export class InMemoryBus implements EventBus {
  private handlers = new Map<string, Handler<Topic>[]>()
  private pending: Promise<void>[] = []

  async publish<T extends Topic>(topic: T, _key: string, event: EventMap[T]): Promise<void> {
    const list = this.handlers.get(topic) ?? []
    for (const h of list) {
      // Deliver asynchronously, like a real broker would.
      this.pending.push(Promise.resolve().then(() => h(event as never)))
    }
  }

  async subscribe<T extends Topic>(topic: T, handler: Handler<T>): Promise<void> {
    const list = this.handlers.get(topic) ?? []
    list.push(handler as Handler<Topic>)
    this.handlers.set(topic, list)
  }

  /** Test helper: wait until every delivered event, including events those handlers publish, has been handled. */
  async idle(): Promise<void> {
    while (this.pending.length > 0) {
      const batch = this.pending
      this.pending = []
      await Promise.all(batch)
    }
  }

  async close(): Promise<void> {
    this.handlers.clear()
  }
}

/** Real Kafka (or Redpanda) through kafkajs. Each service uses its own consumer group. */
export class KafkaBus implements EventBus {
  private kafka: Kafka
  private producer
  private consumers: ReturnType<Kafka['consumer']>[] = []
  private connected = false

  constructor(brokers: string[], private groupId: string, clientId = groupId) {
    this.kafka = new Kafka({ clientId, brokers, logLevel: logLevel.WARN })
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true })
  }

  private async connect() {
    if (this.connected) return
    await this.producer.connect()
    this.connected = true
  }

  async publish<T extends Topic>(topic: T, key: string, event: EventMap[T]): Promise<void> {
    await this.connect()
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(event) }] })
  }

  async subscribe<T extends Topic>(topic: T, handler: Handler<T>): Promise<void> {
    const consumer = this.kafka.consumer({ groupId: `${this.groupId}.${topic}` })
    await consumer.connect()
    await consumer.subscribe({ topic, fromBeginning: false })
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return
        await handler(JSON.parse(message.value.toString()) as EventMap[T])
      },
    })
    this.consumers.push(consumer)
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()))
    if (this.connected) await this.producer.disconnect()
  }
}
