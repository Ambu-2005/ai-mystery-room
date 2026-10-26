export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = new Error('Please check the submitted information.');
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = result.error.flatten().fieldErrors;
      return next(error);
    }
    req.validatedBody = result.data;
    return next();
  };
}
