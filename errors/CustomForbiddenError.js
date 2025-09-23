class CustomForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
    // So the error is neat when stringified. NotFoundError: message instead of Error: message
    this.name = "ForbiddenError";
  }
}

module.exports = CustomForbiddenError;
