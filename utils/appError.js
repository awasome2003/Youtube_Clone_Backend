class AppError extends Error {
  /**
   * Create custom operational error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} [details] - Additional error details
   * @param {string} [code] - Error code for programmatic handling
   * @param {boolean} [isOperational] - Whether error is operational (default: true)
   */
  constructor(
    message,
    statusCode,
    details = {},
    code = null,
    isOperational = true
  ) {
    super(message);

    // Standard properties
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Enhanced debugging
    this.details = details;
    this.code = code || `ERR_${statusCode}`;

    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);

    // Additional metadata for logging
    this.metadata = {
      env: process.env.NODE_ENV || "development",
      service: process.env.SERVICE_NAME || "youtube-clone",
    };
  }

  /**
   * Create a bad request error (400)
   */
  static badRequest(message, details) {
    return new AppError(message, 400, details, "ERR_BAD_REQUEST");
  }

  /**
   * Create an unauthorized error (401)
   */
  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401, {}, "ERR_UNAUTHORIZED");
  }

  /**
   * Create a forbidden error (403)
   */
  static forbidden(message = "Forbidden") {
    return new AppError(message, 403, {}, "ERR_FORBIDDEN");
  }

  /**
   * Create a not found error (404)
   */
  static notFound(resource = "Resource") {
    return new AppError(`${resource} not found`, 404, {}, "ERR_NOT_FOUND");
  }

  /**
   * Create a validation error (422)
   */
  static validationError(errors) {
    return new AppError("Validation failed", 422, { errors }, "ERR_VALIDATION");
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        status: this.status,
        ...(process.env.NODE_ENV === "development" && {
          stack: this.stack,
          details: this.details,
        }),
        timestamp: this.timestamp,
      },
    };
  }
}

module.exports = AppError;
