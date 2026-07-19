import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comments.dto';

@ApiTags('Comments')
@Controller('api/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get('movie/:slug')
  list(@Param('slug') slug: string, @Query('limit') limit?: string) {
    return this.comments.listByMovie(slug, limit ? Number(limit) : 50);
  }

  @ApiBearerAuth()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCommentDto) {
    return this.comments.create({
      userId: user.id,
      movieSlug: body.movie_slug,
      content: body.content,
      isSpoiler: body.is_spoiler,
      episodeName: body.episode_name,
    });
  }
}
