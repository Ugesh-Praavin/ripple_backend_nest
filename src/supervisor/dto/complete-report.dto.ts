import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CompleteReportDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  image_url: string;
}
