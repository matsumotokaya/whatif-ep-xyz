export interface SubscriptionPortalErrorDetails {
  code: string;
  errorId?: string;
  message: string;
  status?: number;
  copyText: string;
}

export class SubscriptionPortalError extends Error {
  details: SubscriptionPortalErrorDetails;

  constructor(details: SubscriptionPortalErrorDetails) {
    super(details.message);
    this.name = 'SubscriptionPortalError';
    this.details = details;
  }
}

const SESSION_RECOVERY_ERROR_CODES = new Set([
  'SubscriptionPortalUnauthorized',
  'SubscriptionPortalClientSessionFailed',
  'SubscriptionPortalClientSessionMissing',
]);

export function isSubscriptionPortalSessionRecoveryError(error: unknown) {
  return error instanceof SubscriptionPortalError
    && SESSION_RECOVERY_ERROR_CODES.has(error.details.code);
}

async function parsePortalErrorResponse(response?: Response) {
  if (!response) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await response.clone().json();
    }

    return {
      error: await response.clone().text(),
    };
  } catch {
    return null;
  }
}

async function buildPortalError(error: unknown, response?: Response) {
  const payload = await parsePortalErrorResponse(response);
  const code = payload?.error_code
    || (response?.status === 401
      ? 'SubscriptionPortalUnauthorized'
      : error instanceof Error
        ? error.name
        : 'SubscriptionPortalUnknownError');
  const message = payload?.details
    || payload?.message
    || payload?.error
    || 'Subscription portal request failed';
  const status = response?.status;
  const errorId = payload?.error_id;

  const lines = [
    `error_code=${code}`,
    `status=${status ?? 'n/a'}`,
    `error_id=${errorId ?? 'n/a'}`,
    `message=${message}`,
  ];

  return new SubscriptionPortalError({
    code,
    errorId,
    message,
    status,
    copyText: lines.join('\n'),
  });
}

export interface CheckoutSessionOptions {
  successPath?: string;
  cancelPath?: string;
}

export async function createCheckoutSessionUrl(
  options: CheckoutSessionOptions = {},
) {
  const response = await fetch('/api/subscription/checkout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.url) {
    throw new Error('checkout_session_failed');
  }

  return data.url as string;
}

export async function createPortalSessionUrl(returnPath = '/mypage') {
  const response = await fetch('/api/account/portal', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnPath }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw await buildPortalError(
      new Error(data?.error || 'Subscription portal request failed'),
      response,
    );
  }

  if (!data?.url) {
    throw new SubscriptionPortalError({
      code: 'SubscriptionPortalMissingUrl',
      message: 'Subscription portal URL was missing from the response',
      copyText: [
        'error_code=SubscriptionPortalMissingUrl',
        'status=200',
        'error_id=n/a',
        'message=Subscription portal URL was missing from the response',
      ].join('\n'),
    });
  }

  return data.url as string;
}
