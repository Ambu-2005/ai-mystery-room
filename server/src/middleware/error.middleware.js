export function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const code = status === 500 ? 'INTERNAL_SERVER_ERROR' : (error.code ?? 'REQUEST_ERROR');
  const message = status === 500 ? 'An unexpected error occurred.' : error.message;

  if (status >= 500) {
    console.error('Unhandled API error', {
      method: req.method,
      path: req.path,
      name: error?.name ?? 'Error',
      code,
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
      ...(typeof error.requestId === 'string' ? { requestId: error.requestId } : {}),
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
