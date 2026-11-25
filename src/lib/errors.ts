// An error that the application expects (wrong password, missing token and so on).
// The service layer throws it with no knowledge of HTTP responses.
// The error handler changes it into an HTTP response.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
