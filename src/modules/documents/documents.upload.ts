import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { MAX_UPLOAD_SIZE_BYTES } from "./documents.validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

export type DocumentUploadRequest = Request & {
  file?: Express.Multer.File;
};

export const documentUploadMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  upload.single("file")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Files larger than 25 MB are not supported."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Only one document file can be uploaded at a time."
            : "Unable to process the uploaded document file.";

      response.status(400).json({
        message: "Validation failed.",
        errors: [message],
      });
      return;
    }

    next(error);
  });
};
