import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadPrivateKeyDto {
  @ApiProperty({ description: '小程序ID' })
  @IsString()
  @IsNotEmpty()
  miniprogramId: string;
}