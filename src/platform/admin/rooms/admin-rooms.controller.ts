import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/auth.decorators';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { AdminRoomsService } from './admin-rooms.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin/rooms')
@UseGuards(PermissionsGuard)
@RequirePermission('rooms:moderate')
export class AdminRoomsController {
  constructor(private readonly rooms: AdminRoomsService) {}
  @Get('stats')
  roomStats() {
    return this.rooms.roomStats();
  }
  @Get()
  listRooms(
    @Query('history')
    history?: string,
  ) {
    return this.rooms.listRooms(history === '1');
  }
  @Delete(':roomId')
  deleteRoom(
    @Param('roomId')
    roomId: string,
  ) {
    return this.rooms.deleteRoom(roomId);
  }
  @Get(':roomId/members')
  members(
    @Param('roomId')
    roomId: string,
  ) {
    return this.rooms.members(roomId);
  }
  @Get(':roomId/messages')
  messages(
    @Param('roomId')
    roomId: string,
    @Query('limit')
    limit?: string,
  ) {
    return this.rooms.messages(roomId, limit ? Number(limit) : undefined);
  }
}
