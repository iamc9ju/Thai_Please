import { SetMetadata } from '@nestjs/common';
import type { ActiveRole } from '../auth.types.js';

export const ROLES_METADATA_KEY = 'required_roles';

export const Roles = (...roles: ActiveRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
