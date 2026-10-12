import { SetMetadata } from '@nestjs/common';
import { AUTH_METADATA } from './auth.constants.js';

export const Public = () => SetMetadata(AUTH_METADATA.public, true);
