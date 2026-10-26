import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

function unauthorized(next) {
  const error = new Error('Please sign in to continue.');
  error.status = 401;
  error.code = 'UNAUTHENTICATED';
  next(error);
}

export function createRequireAuth({ UserModel = User, secret = env.JWT_SECRET, cookieName = env.COOKIE_NAME } = {}) {
  return async (req, _res, next) => {
    const token = req.cookies?.[cookieName];
    if (!token) return unauthorized(next);
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return unauthorized(next);
    }
    try {
      const user = await UserModel.findById(payload.sub).select('_id name email role');
      if (!user) return unauthorized(next);
      req.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function createRequireOwnership({ Model, idParam = 'id', ownerField = 'ownerId' }) {
  if (!Model) throw new TypeError('Model is required for ownership checks.');
  return async (req, _res, next) => {
    try {
      const resource = await Model.findOne({ _id: req.params[idParam], [ownerField]: req.user._id });
      if (!resource) {
        const error = new Error('Resource not found.');
        error.status = 404;
        error.code = 'NOT_FOUND';
        return next(error);
      }
      req.ownedResource = resource;
      return next();
    } catch (error) {
      if (error.name === 'CastError') {
        error.status = 404;
        error.code = 'NOT_FOUND';
      }
      return next(error);
    }
  };
}
