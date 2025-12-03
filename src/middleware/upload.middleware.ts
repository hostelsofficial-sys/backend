import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Error handler for multer
export const handleMulterError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error uploading file',
    });
  }
  
  next();
};

// Middleware to parse multipart form data with JSON fields
export const parseFormData = (req: Request, res: Response, next: NextFunction) => {
  // Parse JSON fields that were sent as strings
  if (req.body.data) {
    try {
      const parsedData = JSON.parse(req.body.data);
      req.body = { ...req.body, ...parsedData };
      delete req.body.data;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data',
      });
    }
  }
  
  // Parse facilities if it's a string
  if (req.body.facilities && typeof req.body.facilities === 'string') {
    try {
      req.body.facilities = JSON.parse(req.body.facilities);
    } catch (error) {
      // Keep as is if not valid JSON
    }
  }
  
  // Parse array fields
  const arrayFields = ['nearbyLocations', 'seoKeywords', 'initialHostelNames', 'customBanks'];
  arrayFields.forEach((field) => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch {
        // Keep as is
      }
    }
  });
  
  next();
};