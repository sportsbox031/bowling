# Firebase Admin Vercel Auth Design

> Goal: Make Firebase Admin initialization work on Vercel without relying on a local file path.

## Recommendation

Add support for a new server environment variable named `FIREBASE_SERVICE_ACCOUNT_JSON`.
In production hosting like Vercel, initialize Firebase Admin from this JSON string first. Keep the existing `FIREBASE_SERVICE_ACCOUNT_PATH` fallback for local development.

## Behavior

- Prefer `FIREBASE_SERVICE_ACCOUNT_JSON` when present
- Fall back to `FIREBASE_SERVICE_ACCOUNT_PATH`
- Fall back to project-only initialization only when explicit credentials are unavailable
- Accept JSON strings with escaped newlines so private keys work correctly in env storage

## Validation

- Add a small script test for the credential parsing helper
- Run the test red first
- Run the test green after implementation
- Run `npm run build`
