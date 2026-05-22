import { FetchHttpError } from '../client/core';

export const PACKAGE_LIMIT_EXCEEDED_CODE = 'PACKAGE_LIMIT_EXCEEDED';
export const CONTRIBUTOR_LIMIT_REACHED_CODE = 'CONTRIBUTOR_LIMIT_REACHED';
export const EVENT_CLOSED_CODE = 'EVENT_CLOSED';

const getErrorCode = (err: unknown): string | null => {
  if (!(err instanceof FetchHttpError)) return null;
  if (!err.body || typeof err.body !== 'object') return null;

  return typeof err.body.code === 'string' ? err.body.code : null;
};

export const isForbiddenError = (err: unknown): boolean => {
  if (!(err instanceof FetchHttpError)) return false;
  return err.status === 403;
};

export const isPackageLimitExceededError = (err: unknown): boolean => {
  if (!isForbiddenError(err)) return false;
  return getErrorCode(err) === PACKAGE_LIMIT_EXCEEDED_CODE;
};

export const isContributorLimitReachedError = (err: unknown): boolean => {
  if (!isForbiddenError(err)) return false;
  return getErrorCode(err) === CONTRIBUTOR_LIMIT_REACHED_CODE;
};

export const isEventClosedError = (err: unknown): boolean => {
  if (!(err instanceof FetchHttpError)) return false;
  if (err.status !== 410) return false;
  return getErrorCode(err) === EVENT_CLOSED_CODE;
};

export const getEventClosedMessage = (err: unknown): string | null => {
  if (!(err instanceof FetchHttpError)) return null;
  if (!err.body || typeof err.body !== 'object') return null;

  return typeof err.body.message === 'string' ? err.body.message : null;
};

