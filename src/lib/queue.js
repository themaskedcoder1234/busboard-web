import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const photoQueue = new Queue('photo-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

// Large uploads (200+ photos) — processed via Anthropic Batch API, 50% cheaper
export const batchQueue = new Queue('batch-processing', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 20 },
  },
})

export const queueEvents = new QueueEvents('photo-processing', { connection })

export { connection }
