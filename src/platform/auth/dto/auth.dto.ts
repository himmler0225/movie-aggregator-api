import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
