import { PartialType } from '@nestjs/swagger';
import { CreateMiniprogramConfigDto } from './create-miniprogram-config.dto';

export class UpdateMiniprogramConfigDto extends PartialType(CreateMiniprogramConfigDto) {}