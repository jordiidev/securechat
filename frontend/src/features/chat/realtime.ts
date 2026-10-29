import { toEncryptedRecord, type MessageDto } from './chatApi';
import type { ConnectionStatus, EncryptedRecord } from './types';

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

type ServerFrame = { type: 'ready' } | { type: 'message'; message: MessageDto };

interface RealtimeHandlers {
  getToken: () => string | null;
  onMessage: (record: EncryptedRecord) => void;
  onStatus: (status: ConnectionStatus) => void;
}

/** WebSocket connection that authenticates with its first frame and reconnects with backoff. */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private retryTimer: number | null = null;
  private retryDelay = INITIAL_RETRY_MS;
  private stopped = true;

  constructor(private readonly handlers: RealtimeHandlers) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    const token = this.handlers.getToken();
    if (!token) return;

    this.handlers.onStatus('connecting');
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws`);
    this.socket = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (event: MessageEvent<string>) => this.handleFrame(event.data);
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.handlers.onStatus('offline');
      this.scheduleReconnect();
    };
  }

  private handleFrame(raw: string): void {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      return;
    }

    if (frame.type === 'ready') {
      this.retryDelay = INITIAL_RETRY_MS;
      this.handlers.onStatus('online');
    } else if (frame.type === 'message') {
      this.handlers.onMessage(toEncryptedRecord(frame.message));
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.retryTimer = window.setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
  }
}
