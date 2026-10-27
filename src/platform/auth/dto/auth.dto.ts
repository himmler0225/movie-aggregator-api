import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  username!: string;
}

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Legacy: normally sent as the httpOnly cf_rt cookie.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  refresh_token?: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
