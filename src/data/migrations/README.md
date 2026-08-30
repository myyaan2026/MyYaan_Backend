# Database migrations

Run all pending migrations in the configured database:

```bash
npm run db:migrate
```

The runner applies each migration in a transaction and records it in
`schema_migrations`. Never edit a migration after it has been applied to a
shared database; add a new migration for the next schema change.

## Device identity

`device_token` is an app-installation UUID generated once by the mobile app and
stored locally. It is not an IMEI and it is not a Firebase/APNs push token.

- Generate a UUID when the app first starts.
- Persist it in Keychain on iOS or encrypted local storage on Android.
- Reuse it for later logins from that app installation.
- Send a changing Firebase/APNs token separately as `pushToken` with its
  `pushProvider` when push notifications are enabled.

After OTP verification, call `PUT /api/devices` with the short-lived
`deviceRegistrationToken` returned by the verification response.

