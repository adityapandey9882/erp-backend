import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { MAX_PROFILE_PHOTO_UPLOAD_SIZE_BYTES } from "./employee-self.validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PHOTO_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

export type EmployeeProfilePhotoUploadRequest = Request & {
  file?: Express.Multer.File;
};

export const employeeProfilePhotoUploadMiddleware = (
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
          ? "Profile photos larger than 2 MB are not supported."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Only one profile photo can be uploaded at a time."
            : "Unable to process the uploaded profile photo.";

      response.status(400).json({
        message: "Validation failed.",
        errors: [message],
      });
      return;
    }

    next(error);
  });
};
