import { ApiProperty } from '@nestjs/swagger';
import type { ConsumerProfileResponse } from '@thai-please/contracts';

export class ConsumerProfileDto implements ConsumerProfileResponse {
  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  maskedCitizenId!: string;

  @ApiProperty({ enum: ['CONSUMER'] })
  role!: 'CONSUMER';

  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  address!: string | null;
}
