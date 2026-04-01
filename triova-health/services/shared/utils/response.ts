import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, any>;
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200, meta?: Record<string, any>) {
  const response: ApiResponse<T> = { success: true, data, message, meta };
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, error: string, statusCode = 500, meta?: Record<string, any>) {
  const response: ApiResponse = { success: false, error, meta };
  return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string
) {
  return res.status(200).json({
    success: true,
    data,
    message,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
}
