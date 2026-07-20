// SSE pub/sub manager for real-time cross-device sync.
// Maintains a Map of userId → Set of { controller, deviceId } so we can push events
// to all connected clients except the originator.

interface SSEClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  deviceId: number | null;
}

const clients = new Map<number, Set<SSEClient>>();

export function addClient(userId: number, controller: ReadableStreamDefaultController<Uint8Array>, deviceId: number | null = null): void {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add({ controller, deviceId });
}

export function removeClient(userId: number, controller: ReadableStreamDefaultController<Uint8Array>): void {
  const userClients = clients.get(userId);
  if (!userClients) return;
  for (const client of userClients) {
    if (client.controller === controller) {
      userClients.delete(client);
      break;
    }
  }
  if (userClients.size === 0) {
    clients.delete(userId);
  }
}

export interface SyncEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  sourceDeviceId?: number;
}

// In-memory event log for polling fallback (last 1000 events)
const eventLog: Array<{ userId: number; event: SyncEvent }> = [];
const MAX_EVENT_LOG = 1000;

function addToEventLog(userId: number, event: SyncEvent): void {
  eventLog.push({ userId, event });
  while (eventLog.length > MAX_EVENT_LOG) {
    eventLog.shift();
  }
}

export function broadcastToUser(userId: number, event: SyncEvent, excludeDeviceId?: number): void {
  // Add to event log for polling clients
  addToEventLog(userId, event);

  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const encoder = new TextEncoder();
  const data = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of userClients) {
    // Don't send back to the originating device
    if (excludeDeviceId && client.deviceId === excludeDeviceId) continue;
    try {
      client.controller.enqueue(encoder.encode(data));
    } catch {
      // Client disconnected — will be cleaned up on next write
    }
  }
}

export function getPollingEvents(userId: number, since: number): SyncEvent[] {
  const cutoff = new Date(since).toISOString();
  return eventLog
    .filter(e => e.userId === userId && e.event.timestamp > cutoff)
    .map(e => e.event);
}

export function getClientCount(userId: number): number {
  return clients.get(userId)?.size ?? 0;
}
