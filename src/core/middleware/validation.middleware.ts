import type { NextFunction, Request, Response } from "express";

type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: string[];
    };

type Validator<T> = (input: unknown) => ValidationResult<T>;

export function validationMiddleware<T>(validator?: Validator<T>) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!validator) {
      next();
      return;
    }

    const result = validator(request.body);

    if (!result.success) {
      response.status(400).json({
        message: "Validation failed.",
        errors: result.errors,
      });
      return;
    }

    request.body = result.data as Request["body"];
    next();
  };
}
