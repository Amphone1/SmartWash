/**
 * Socket.IO gateway for live driver tracking. Clients subscribe to a driver
 * room and receive `gps.location` events as pings arrive.
 */
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class GpsGateway implements OnGatewayInit {
  private readonly logger = new Logger('GpsGateway');
  @WebSocketServer() private server!: Server;

  afterInit(): void {
    this.logger.log('Socket.IO GPS gateway ready');
  }

  @SubscribeMessage('track')
  onTrack(
    @MessageBody() body: { driverId?: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (body?.driverId) client.join(`driver:${body.driverId}`);
    return { ok: true };
  }

  emitLocation(driverId: string, location: Record<string, unknown>): void {
    this.server?.to(`driver:${driverId}`).emit('gps.location', location);
  }
}
