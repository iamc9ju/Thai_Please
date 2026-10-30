import crypto from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALLOWED_IMAGE_MIME_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
] as const;

const MAX_BASE64_IMAGE_CHARS = 7_500_000; // ~5.5MB raw image

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
  asset_folder?: string;
  error?: { message?: string };
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {}

  async uploadProductImage(
    dataUrl: string,
    merchantId: bigint,
  ): Promise<{ imageUrl: string; publicId: string }> {
    const normalized = dataUrl.trim();
    const isAllowedMime = ALLOWED_IMAGE_MIME_PREFIXES.some((prefix) =>
      normalized.toLowerCase().startsWith(prefix),
    );
    if (!isAllowedMime) {
      throw new BadRequestException(
        'รองรับเฉพาะไฟล์รูปภาพนามสกุล JPG, PNG หรือ WEBP เท่านั้น',
      );
    }

    if (normalized.length > MAX_BASE64_IMAGE_CHARS) {
      throw new BadRequestException(
        'ขนาดไฟล์รูปภาพต้องไม่เกิน 5 MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง',
      );
    }

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    const baseFolder =
      this.configService.get<string>('CLOUDINARY_ASSET_FOLDER') ??
      'thai-please/products';

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'ระบบอัปโหลดรูปภาพยังไม่ได้ตั้งค่า Cloudinary',
      );
    }

    const assetFolder = `${baseFolder}/merchant-${merchantId.toString()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `product_${merchantId.toString()}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const paramsToSign: Record<string, string> = {
      asset_folder: assetFolder,
      public_id: publicId,
      timestamp,
    };

    const sortedString = Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join('&');

    const signature = crypto
      .createHash('sha1')
      .update(`${sortedString}${apiSecret}`)
      .digest('hex');

    const formData = new FormData();
    formData.append('file', normalized);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('asset_folder', assetFolder);
    formData.append('public_id', publicId);

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(20_000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'ไม่สามารถเชื่อมต่อกับบริการจัดเก็บรูปภาพ Cloudinary ได้',
      );
    }

    const payload = (await response
      .json()
      .catch(() => ({}))) as CloudinaryUploadResponse;

    if (!response.ok || !payload.secure_url) {
      throw new InternalServerErrorException(
        payload.error?.message || 'อัปโหลดรูปภาพไปยัง Cloudinary ไม่สำเร็จ',
      );
    }

    return {
      imageUrl: payload.secure_url,
      publicId: payload.public_id ?? publicId,
    };
  }
}
