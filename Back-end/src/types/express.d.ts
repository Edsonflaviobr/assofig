import type { AuthUser } from '../utils/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
