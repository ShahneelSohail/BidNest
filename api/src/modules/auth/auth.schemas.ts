import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Invalid email format').max(255);
const password = z.string().min(8, 'Password must be at least 8 characters long').max(100);

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters long')
    .max(100, 'Username cannot exceed 100 characters')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes and underscores'),
  email,
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Full name cannot exceed 200 characters'),
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
  email,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});
