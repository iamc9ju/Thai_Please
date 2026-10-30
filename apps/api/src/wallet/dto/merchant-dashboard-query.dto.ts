import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DASHBOARD_TREND_DAYS,
  DASHBOARD_TREND_PAGE_LIMITS,
} from '../wallet.constants.js';

export class MerchantDashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 14, 30])
  days: number = DASHBOARD_TREND_DAYS.DEFAULT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DASHBOARD_TREND_PAGE_LIMITS.MAX)
  pageSize: number = DASHBOARD_TREND_PAGE_LIMITS.DEFAULT;
}
