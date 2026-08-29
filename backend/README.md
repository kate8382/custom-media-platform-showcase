# Backend placement and conventions

This project uses a single `package.json` in the repository root for dependency management.
The `backend/` folder is a logical container for backend source and configuration only — it does not have its own `package.json`.

## Conventions

- Install dependencies in the repository root (run `npm install` from project root).
- Place server entrypoint in `backend/` (recommended filename: `server.js` or `server/express.js` or `server/index.js`).
- The build process copies backend static files into `dist/backend/` when `npm run build` is executed.

## Developer notes

If you need to run the backend locally during development, you can start it from the repository root, for example:

```bash
# from project root
node backend/server.js
```

If you'd like a different file name (e.g. `express.js`, `index.js`), document it here and update any start scripts in `package.json` accordingly.

If you need additional dependencies for the backend, add them to the root `package.json` and run `npm install` from the repo root.

## Environment file configuration

The server uses and expects a `.env` file in the same directory as `server.js` to provide some environment variables. The following structure should be used to create the `.env` file:

```
# Express server mode: development / production / test / staging
NODE_ENV=

# Express server port
PORT=

# Email account to send email from
EMAIL_FROM_USER=

# Email account to send email to
EMAIL_TO_USER=

# Email account password to log into
EMAIL_FROM_PASSWORD=

# Email service name to use
EMAIL_SERVICE_NAME=

# Optional: allow selecting recipients from the frontend contact form
# Provide a semicolon-separated list of allowed recipient email addresses.
# If omitted and EMAIL_TO_USER is not set, the server will accept any recipient
# provided by the frontend (useful for local development). Recommended to set
# this in production to avoid forwarding to arbitrary addresses.
EMAIL_RECIPIENTS=your+recipient@example.com;other@example.com
```

### Fail-safe Setup

If the server finds no `.env` file or the expected variables are missing, the server has been configured to do the following:

- Operate in _development_ mode for `NODE_ENV`.
- Use port 3000 for the server port.
- Create and use an Etheral mail account as long as the server is not in _production_ mode.

There is also a function that sets up the mail service and this function logs to the console any errors that may occur while setting up the mail service.
