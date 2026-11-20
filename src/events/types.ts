export const TOPICS = {
  received: 'requests.received',
  triaged: 'requests.triaged',
  assigned: 'requests.assigned',
  queued: 'requests.queued',
  status: 'requests.status',
} as const

export type Topic = (typeof TOPICS)[keyof typeof TOPICS]

export type RequestType = 'outage' | 'dns_email' | 'bug' | 'content' | 'seo' | 'feature' | 'other'
export type Priority = 1 | 2 | 3 | 4
export type RequestStatus = 'received' | 'triaged' | 'assigned' | 'queued'

export interface RequestReceived { requestId: string; client: string; message: string }
export interface RequestTriaged { requestId: string; client: string; type: RequestType; priority: Priority; effortHours: number }
export interface RequestAssigned { requestId: string; assignee: string; effortHours: number }
export interface RequestQueued { requestId: string; reason: 'no_capacity' }
export interface RequestStatusChanged {
  requestId: string
  client: string
  status: RequestStatus
  priority?: Priority
  assignee?: string
  reason?: string
}

export interface EventMap {
  [TOPICS.received]: RequestReceived
  [TOPICS.triaged]: RequestTriaged
  [TOPICS.assigned]: RequestAssigned
  [TOPICS.queued]: RequestQueued
  [TOPICS.status]: RequestStatusChanged
}
