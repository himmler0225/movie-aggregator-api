import {
  Body,
  Controller,
  Delete,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/auth.decorators';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { DeleteCommentsDto } from '../dto/admin.dto';
import { AdminCommentsService } from './admin-comments.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin/comments')
@UseGuards(PermissionsGuard)
@RequirePermission('comments:moderate')
export class AdminCommentsController {
  constructor(private readonly adminComments: AdminCommentsService) {}
  @Get('stats')
  commentStats() {
    return this.adminComments.commentStats();
  }
  @Get()
  listComments(
    @Query('query')
    query = '',
    @Query('movie')
    movie = '',
    @Query('sort')
    sort: 'new' | 'likes' = 'new',
    @Query('page')
    page = '0',
    @Query('pageSize')
    pageSize = '20',
  ) {
    return this.adminComments.listComments({
      query,
      movie,
      sort,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }
  @Delete()
  deleteComments(
    @Body()
    body: DeleteCommentsDto,
  ) {
    return this.adminComments.deleteComments(body.ids);
  }
  @Get('recent')
  recentComments() {
    return this.adminComments.recentComments();
  }
}
