import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: dataSchema,
});

// Generic API Response which can be either Success or Error
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => 
  z.union([SuccessResponseSchema(dataSchema), ErrorResponseSchema]);

// --- Define your specific API payloads below ---

// Example: User Profile
export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const GetUserProfileResponseSchema = SuccessResponseSchema(UserProfileSchema);
export type GetUserProfileResponse = z.infer<typeof GetUserProfileResponseSchema>;

// Example: Generic Pagination Request
export const PaginationRequestSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;
