import { Module } from '@nestjs/common';
import { AiChatMessagesRepository } from './ai-chat-messages.repository';
import { AiConversationsRepository } from './ai-conversations.repository';
import { CommentsRepository } from './comments.repository';
import { FavoritesRepository } from './favorites.repository';
import { MovieRatingsRepository } from './movie-ratings.repository';
import { PageViewsRepository } from './page-views.repository';
import { ProfilesRepository } from './profiles.repository';
import { RolePermissionsRepository } from './role-permissions.repository';
import { RoomMembersRepository } from './room-members.repository';
import { RoomMessagesRepository } from './room-messages.repository';
import { SearchLogsRepository } from './search-logs.repository';
import { UserWatchlistsRepository } from './user-watchlists.repository';
import { WatchEventsRepository } from './watch-events.repository';
import { WatchHistoryRepository } from './watch-history.repository';
import { WatchRoomsRepository } from './watch-rooms.repository';
import { RefreshTokensRepository } from './refresh-tokens.repository';

const repositories = [
  AiConversationsRepository,
  AiChatMessagesRepository,
  ProfilesRepository,
  FavoritesRepository,
  CommentsRepository,
  MovieRatingsRepository,
  WatchHistoryRepository,
  UserWatchlistsRepository,
  WatchRoomsRepository,
  RoomMembersRepository,
  RoomMessagesRepository,
  PageViewsRepository,
  WatchEventsRepository,
  SearchLogsRepository,
  RolePermissionsRepository,
  RefreshTokensRepository,
];

@Module({
  providers: [...repositories],
  exports: [...repositories],
})
export class RepositoriesModule {}
