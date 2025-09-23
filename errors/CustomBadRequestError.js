class CustomBadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
    // So the error is neat when stringified. BadRequestError: message instead of Error: message
    this.name = "BadRequestError";
  }
}

module.exports = CustomBadRequestError;
