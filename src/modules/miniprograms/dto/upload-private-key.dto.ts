import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadPrivateKeyDto {
  @ApiProperty({ description: '小程序ID' })
  @IsString()
  @IsNotEmpty()
  miniprogramId: string;
}