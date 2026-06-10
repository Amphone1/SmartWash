/**
 * Socket.IO gateway pushing live machine status to clients. A client subscribes
 * to a branch room and receives `machine.status` events for that branch.
 */
import {
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import type { MachineStatusView } from '../../domain/ports';

@WebSocketGateway({ cors: { origin: '*' } })
export class MachineGateway implements OnGatewayInit {
  private readonly logger = new Logger('MachineGateway');
  @WebSocketServer() private server!: Server;

  afterInit(): void {
    this.logger.log('Socket.IO machine gateway ready');
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @MessageBody() body: { branchId?: string },
    @ConnectedSocket() client: Socket,
  ): { ok: boolean } {
    if (body?.branchId) client.join(`branch:${body.branchId}`);
    return { ok: true };
  }

  emitStatus(branchId: string | null, view: MachineStatusView): void {
    if (!this.server) return;
    if (branchId) this.server.to(`branch:${branchId}`).emit('machine.status', view);
  }
}
