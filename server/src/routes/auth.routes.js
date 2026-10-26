
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { createRequireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { loginSchema, registerSchema } from '../validators/auth.schema.js';

const SESSION_SECONDS = 7 * 24 * 60 * 60;

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function cookieOptions() {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/v1/',
    maxAge: SESSION_SECONDS * 1000,
  };
}

function requestError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function createAuthRouter({
  UserModel = User,
  secret = env.JWT_SECRET,
  cookieName = env.COOKIE_NAME,
  limiter,
} = {}) {
  const router = Router();

  const requireAuth = createRequireAuth({
    UserModel,
    secret,
    cookieName,
  });

  const authenticate = (user, res) => {
    const token = jwt.sign(
      { sub: String(user._id) },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: SESSION_SECONDS,
      }
    );

    res.cookie(cookieName, token, cookieOptions());
  };

  const authLimiter =
    limiter ?? ((_req, _res, next) => next());

  // Register a new account
  router.post(
    '/register',
    authLimiter,
    validateBody(registerSchema),
    async (req, res, next) => {
      try {
        const { name, email, password } = req.validatedBody;

        const existing = await UserModel.findOne({ email });

        if (existing) {
          return next(
            requestError(
              409,
              'EMAIL_ALREADY_EXISTS',
              'An account with this email already exists.'
            )
          );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await UserModel.create({
          name,
          email,
          passwordHash,
        });

        authenticate(user, res);

        return res.status(201).json({
          success: true,
          data: {
            user: publicUser(user),
          },
        });
      } catch (error) {
        if (
          error?.code === 11000 &&
          error?.keyPattern?.email
        ) {
          return next(
            requestError(
              409,
              'EMAIL_ALREADY_EXISTS',
              'An account with this email already exists.'
            )
          );
        }

        return next(error);
      }
    }
  );

  // Sign in
  router.post(
    '/login',
    authLimiter,
    validateBody(loginSchema),
    async (req, res, next) => {
      try {
        const { email, password } = req.validatedBody;

        const user = await UserModel.findOne({ email })
          .select('+passwordHash');

        if (
          !user ||
          !(await bcrypt.compare(password, user.passwordHash))
        ) {
          return next(
            requestError(
              401,
              'INVALID_CREDENTIALS',
              'Email or password is incorrect.'
            )
          );
        }

        authenticate(user, res);

        return res.json({
          success: true,
          data: {
            user: publicUser(user),
          },
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  // Sign out
  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...options } = cookieOptions();

    res.clearCookie(cookieName, options);

    return res.json({
      success: true,
      data: {
        loggedOut: true,
      },
    });
  });

  // Get the currently authenticated user
  router.get('/me', requireAuth, (req, res) => {
    return res.json({
      success: true,
      data: {
        user: publicUser(req.user),
      },
    });
  });

  return router;
}
