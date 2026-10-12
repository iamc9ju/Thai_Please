import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class TopupDto {
  @ApiProperty({ description: 'Integer Thai baht', minimum: 1 })
  @IsInt()
  @Min(1)
  amount!: number;
}
