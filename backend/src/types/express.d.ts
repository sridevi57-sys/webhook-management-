import { User, ApiKey } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      apiKey?: {
        id: string;
        key: string;
        userId: string;
      };
    }
  }
}
