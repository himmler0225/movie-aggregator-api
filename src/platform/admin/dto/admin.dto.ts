import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { PROFILE_STATUS } from '../../../shared/constants';

export class UpdateUserRoleDto {
  @ApiProperty()
  @IsString()
  role!: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: [PROFILE_STATUS.APPROVED, PROFILE_STATUS.REJECTED] })
  @IsString()
  @IsIn([PROFILE_STATUS.APPROVED, PROFILE_STATUS.REJECTED])
  status!: 'approved' | 'rejected';
}

export class DeleteCommentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
