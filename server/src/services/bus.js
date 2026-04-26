import { EventEmitter } from 'node:events'

class SessionBus {
  constructor() {
    this.emitters = new Map()
  }

  get(sessionId) {
    if (!this.emitters.has(sessionId)) this.emitters.set(sessionId, new EventEmitter())
    return this.emitters.get(sessionId)
  }

  publish(sessionId, event) {
    this.get(sessionId).emit('event', event)
  }

  subscribe(sessionId, cb) {
    const emitter = this.get(sessionId)
    emitter.on('event', cb)
    return () => emitter.off('event', cb)
  }

  cleanup(sessionId) {
    const emitter = this.emitters.get(sessionId)
    if (emitter) {
      emitter.removeAllListeners()
      this.emitters.delete(sessionId)
    }
  }
}

export const bus = new SessionBus()
