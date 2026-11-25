// "authenticate" puts the user on the request. This tells TypeScript about it.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; tier: string };
    }
  }
}

export {};
