import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiProperty({
    description:
      'Top-level keys to replace (player, moviePrefs, settings, recentSearches, episodeSnapshots, notifReadAt).',
    type: Object,
  })
  @IsObject()
  data!: Record<string, unknown>;
}
