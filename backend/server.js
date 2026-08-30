/** Built-in Module Imports */
import fs from 'fs';
import path from 'path';
import process from 'process';
import url from 'url';
/** Named Module Imports */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import validator from 'validator';
import Ajv from 'ajv';
/** Installed Module Imports */
import * as mailer from 'nodemailer';


/** Configure the dotenv module to add the variables in the .env file to the environment path. This is done at this point so the script specific global variables that rely on the environment variables can be initialized. The results are stored in a variable for easier use. */
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// Load environment variables from .env (if present). Prefer values already
// present in process.env so tests can set env vars before importing this module.
dotenv.config({ path: path.join(__dirname, '.env'), silent: true });


/** Script specific global variables */
// Website domain address (can be overridden via FRONTEND_URL env var)
const websiteDomain = process.env.FRONTEND_URL || 'custom-media-platform-showcase';
// Set the mode of the server
const _rawNodeEnv = process.env.NODE_ENV;
const SERVER_MODE = {
    CURR_MODE: _rawNodeEnv ? _rawNodeEnv.toString().toLowerCase() : "development",
    DEV_MODE: "development",
    PROD_MODE: "production",
    TEST_MODE: "test",
    STAGE_MODE: "staging"
}
// derive production flag: either explicit SERVER_LIVE=true in .env or NODE_ENV=production
/* This allows for flexible configuration: NODE_ENV can be set to 'production' for general production optimizations, while SERVER_LIVE can be used to specifically control production features like email sending. This is especially useful in cases where you want to run in production mode but still use test email accounts, or vice versa.*/
const isProduction = (process.env.SERVER_LIVE?.toString?.().toLowerCase?.() === 'true') || (SERVER_MODE.CURR_MODE === SERVER_MODE.PROD_MODE);
// Set the server port
const PORT = isProduction && process.env.PORT ? process.env.PORT : 3000;
// Variables for email rate limiting
const rateLimitMap = new Map(); // ip -> { count, firstTs }
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // max submissions per IP per window
// Variables to assist with console and return messages
const msgObjConsole = {
    NOSMTP: "No SMTP credentials found — creating Ethereal test account for local development",
    ETHACCT: "Ethereal account created: ",
    MAILDISABLED: "No SMTP configuration and running in production — mailer disabled",
    CONNSUCCESS: "Connection verification to email server was successful!",
    CONNFAILURE: "Couldn't verify connection to email server. The following error occurred:\n",
    MAILERNOAUTH: "Mailer is not authenticated; cannot send contact email.",
    PREVIEWMSG: "Preview URL: ",
    POSTERR: "Contact POST error:\n",
    JSONREADERR: "Error reading JSON file:\n",
    JSONVALIDATION: "JSON validation failed:\n",
}
const msgObjStatusReturn = {
    LIMIT_EXCEED: "Rate limit exceeded. Try again later.",
    FIELDS_MISSING: "Missing required fields: name, email, message",
    EMAIL_INVALID: "Invalid email address",
    MSG_LENGTH_SHORT: "Message is too short (min 20 chars)",
    SRVC_UNAVAILABLE: "Email service unavailable",
    MSG_SUCCESS: "Message sent",
    SRVR_ERROR: "Internal server error",
    JSON_INVALID: "JSON data validation failed",
}
// Variables for storing path and directory names
const BANDCAMP_JSON_FILE = "track_data.json";
const BANDCAMP_JSON_SCHEMA = "track_data.schema.json";
let staticDir;
// Variables for the email service
const testMailSetting = {
    host: "smtp.ethereal.email",
    port: 587,
    secure: false
}
// Variable to set the CORS options for production
const allowedURLs = process.env.FRONTEND_URL || "";
const allowedOrigins = allowedURLs ? allowedURLs.split(";").map(url => url.replace(/\/$/, "")) : [];
if (!isProduction) {
    allowedOrigins.push(`http://localhost:${PORT}`);
    // Vite dev server commonly runs on 5173 — allow it for local development
    allowedOrigins.push('http://localhost:5173');
    allowedOrigins.push('http://127.0.0.1:5173');
}
const corsOptions = {
    origin: (incomingDomain, callback) => {
        // Check if the incoming request origin is in your whitelist
        // We also check !origin for requests without an Origin header (like server-to-server)
        if (!incomingDomain || allowedOrigins.includes(incomingDomain)) {
            callback(null, true);
        }
        else {
            callback(new Error(`The domain ${incomingDomain} is not allowed by CORS policy!`))
        }

    },
    optionsSuccessStatus: 200
}
/** Mailer credentials are pulled from environment variables. If not present, they will be set to empty strings, which will trigger the Ethereal test account creation in the mailer setup function. */
let mailerUserFrom = process.env.EMAIL_FROM_USER || "";
let mailerUserTo = process.env.EMAIL_TO_USER || "";
let mailerPasswordFrom = process.env.EMAIL_FROM_PASSWORD || "";
let mailerServiceName = process.env.EMAIL_SERVICE_NAME || "";
let mailerConnectAuth;
// Allowed recipients may be provided as a semicolon-separated list in env
const allowedRecipientsEnv = process.env.EMAIL_RECIPIENTS || '';
const ALLOWED_RECIPIENTS = allowedRecipientsEnv
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
if (mailerUserTo && !ALLOWED_RECIPIENTS.includes(mailerUserTo)) ALLOWED_RECIPIENTS.push(mailerUserTo);


/** Module specific global variables:
 * - Create the Express app
 * - Create an Ajv object to use for the JSON schema validation
 * - Create a transporter instance for nodemailer  */
const app = express();
const ajv = new Ajv({ allErrors: true });
let mailTransporter;


/** Variable and setup initialization */

/** Set the static directory if the server is running in production mode. If it's not, the Vite dev server handles the frontend.
 *
 * The directory can be overridden via the FRONTEND_DIST_DIR environment variable
 * (e.g. "dist/frontend") to support CI/tests creating files in a different place
 * without changing production behaviour. Default fallback is the original
 * 'frontend' directory to preserve backwards compatibility with existing prod setups.
 */
// Resolve frontend static directory robustly:
// - If FRONTEND_DIST_DIR is absolute, use it as-is.
// - If relative, resolve it relative to the repository root (directory containing package.json).
// - If repo root can't be found, fall back to the previous behaviour (relative to __dirname).
const frontendDirName = process.env.FRONTEND_DIST_DIR || 'frontend';

function findRepoRoot(start = __dirname) {
    let cur = path.resolve(start);
    while (cur) {
        try {
            if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
        }
        catch (e) { }

        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
    }

    return null;
}

if (isProduction) {
    if (path.isAbsolute(frontendDirName)) {
        staticDir = frontendDirName;
    }
    else {
        const repoRoot = findRepoRoot(__dirname);
        if (repoRoot) {
            staticDir = path.join(repoRoot, frontendDirName);
        }
        else {
            staticDir = path.join(__dirname, '..', frontendDirName);
        }
    }
}

/**
 * This function sets up the mailer service for the nodemailer module. The mail transporter from the module is initialized using the following:
 *
 * If SMTP credentials have been provided, the mail transporter uses them.
 * If there are no credentials and the server is not in production mode, an Ethereal account is created for testing purposes. This allows for verification that emails are being sent.
 *
 * Finally, the module verify function is called on the mail transporter to determine whether a connection to the email server is possible. The results are stored in the global variable mailerConnectAuth.
 *
 */
async function setupMailer() {
    try {
        if (mailerUserFrom && mailerPasswordFrom && mailerServiceName) {
            mailTransporter = mailer.createTransport({
                service: mailerServiceName,
                auth: { user: mailerUserFrom, pass: mailerPasswordFrom }
            });
        }
        else if (SERVER_MODE.CURR_MODE !== SERVER_MODE.PROD_MODE) {
            console.log(msgObjConsole.NOSMTP);

            const testAcct = await mailer.createTestAccount();

            // default sender/recipient to test account when not explicitly set
            mailerUserFrom = mailerUserFrom || testAcct.user;
            mailerUserTo = mailerUserTo || testAcct.user;

            mailTransporter = mailer.createTransport({
                host: testMailSetting.host,
                port: testMailSetting.port,
                secure: testMailSetting.secure,
                auth: { user: testAcct.user, pass: testAcct.pass }
            });

            console.log(msgObjConsole.ETHACCT + testAcct.user);
        }
        else {
            console.warn(msgObjConsole.MAILDISABLED);

            mailerConnectAuth = false;
            return;
        }

        await mailTransporter.verify();
        mailerConnectAuth = true;

        console.log(msgObjConsole.CONNSUCCESS);
    }
    catch (err) {
        mailerConnectAuth = false;

        console.log(msgObjConsole.CONNFAILURE + err);
    }
}


/** Middleware setup:
 * - Set up CORS using the corsOptions constant to determine which IPs/URLs to whitelist
 * - Add the ability to handle complex form data through POST
 * - Add the ability to handle JSON data through POST
 * - If in production mode, specify the static directory that Express should use
 * - Test the email connection
 */
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
if (isProduction) {
    // console.log(`staticDir: ${staticDir}`);
    app.use(express.static(staticDir));
}
// Determine if we're running under a test runner (Vitest) or explicit test NODE_ENV.
// Treat any invocation where Vitest is present (VITEST env var is defined) or
// NODE_ENV is 'test' as a test run. This avoids starting the server or
// initializing network mailer connections during unit tests. Tests that need
// mailer behavior can explicitly set `NODE_ENV=development` and mock
// `nodemailer` to opt into mailer initialization.
const isTestRunner = (SERVER_MODE.CURR_MODE === SERVER_MODE.TEST_MODE) || (typeof process.env.VITEST !== 'undefined' && process.env.NODE_ENV !== 'development') || process.env.NODE_ENV === 'test';

// Initialize mailer setup (real SMTP or Ethereal fallback in dev)
// Skip mailer initialization when running under tests to avoid network calls
if (!isTestRunner) {
    setupMailer();
}


/** Helper functions */

/**
 * This function checks to see if the rate limit has been reached for a specific ip. The rate limit pertains to how many messages from the contact form that ip can send in a given time frame. The rate for now is set to 10 times per hour.
 *
 * Each ip is added to a Map variable (rateLimitMap). The ip becomes the key, and the value is an object containing a count and a date stamp using Date.now(). The count specifies how many times the ip has sent a message. The date stamp is populated the first time an ip is added to the Map.
 *
 * The current date stamp is gotten and the ip is retrieved from the Map. If it doesn't exist, then it's added with a count of 1 and the date stamp. If it exists, then two checks are performed:
 *
 * The first is to see if the difference between the current date stamp and the first one recorded in the Map is over an hour. If so, then the value object for that ip is reset - the count goes back to 1, and the recorded first date stamp becomes the current one.
 *
 * The second is to see if the count for the ip is over 10. Since the first check has already processed, this second check means the ip is over the rate limit.
 *
 * Finally, the count is increased by one.
 *
 * @param {string} ip The ip address of the incoming request (see the Contact form endpoint route)
 * @returns Boolean value representing if the rate limit has been reached. True means it has; false means it hasn't.
 */
function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry) {
        rateLimitMap.set(ip, { count: 1, firstTs: now });
        return false;
    }

    if (now - entry.firstTs > RATE_LIMIT_WINDOW) {
        // reset window
        rateLimitMap.set(ip, { count: 1, firstTs: now });
        return false;
    }

    if (entry.count >= RATE_LIMIT_MAX) return true;

    entry.count += 1;
    return false;
}

/**
 * This function will create the fully formed HTML code to return to the GET /api/bandcamp call.
 *
 * It does this by parsing the JSON data object passed in and using the data to create the embed iframe and anchor code that Bandcamp uses. The specific code needed for each track listed in the JSON data is generated and added together.
 *
 * Each track code is wrapped in list elements for easier inclusion client-side. This means, for each track, the HTML code consists of: <li><iframe><a></a></iframe></li>
 *
 * The generated HTML code is stored as a string and returned.
 *
 * @param {object} jsonData An object representing the JSON data found in the file track_data.json
 * @returns string A string representing the fully formed HTML code to return to the API
 */
function createBandcampLinks(jsonData) {
    const tracksArray = jsonData.Tracks;
    const bandcampURL = jsonData.BandcampURL;

    let completeHTML = "";

    // simple HTML escaper to avoid injecting raw values into attributes/text
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    for (let track of tracksArray) {
        const bandcampInfo = track.BandcampEmbedInfo;
        const embedInfo = bandcampInfo.EmbedStyle;

        const safeTrackId = Number(bandcampInfo.TrackId) || 0;
        const safeIFrameSize = escapeHtml(embedInfo.IFrameSize);
        const safeBg = escapeHtml(embedInfo.BackgroundColor);
        const safeLink = escapeHtml(embedInfo.LinkColor);
        const safeTrackList = embedInfo.TrackListShow ? 'true' : 'false';
        const safeTransparent = embedInfo.TransparentShow ? 'true' : 'false';
        const safeWidth = Number(embedInfo.IFrameWidth.Amount) || 0;
        const safeWidthUnit = escapeHtml(embedInfo.IFrameWidth.Units || 'px');
        const safeHeight = Number(embedInfo.IFrameHeight.Amount) || 0;
        const safeHeightUnit = escapeHtml(embedInfo.IFrameHeight.Units || 'px');

        const safeAnchorText = escapeHtml(bandcampInfo.AnchorText);
        const safeAnchorName = encodeURIComponent(String(bandcampInfo.AnchorTrackName || '').trim());
        const safeBandcampURL = escapeHtml(bandcampURL.replace(/\/$/, ''));

        let trackHTML = `<li class="playlist__item"><iframe class="playlist__iframe" style="border:0;width:${safeWidth}${safeWidthUnit};height:${safeHeight}${safeHeightUnit};" src="https://bandcamp.com/EmbeddedPlayer/track=${safeTrackId}/size=${safeIFrameSize}/bgcol=${safeBg}/linkcol=${safeLink}/tracklist=${safeTrackList}/transparent=${safeTransparent}/" seamless><a href="${safeBandcampURL}/track/${safeAnchorName}">${safeAnchorText}</a></iframe></li>`;

        completeHTML += trackHTML;
    }
    return completeHTML;
}


/** Route logic */

// Bandcamp tracks endpoint
app.get('/api/bandcamp', async (req, res) => {
    const jsonFilePath = path.join(__dirname, BANDCAMP_JSON_FILE);
    const jsonSchemaPath = path.join(__dirname, BANDCAMP_JSON_SCHEMA);

    try {
        const [rawFileData, rawSchemaData] = await Promise.all([
            fs.promises.readFile(jsonFilePath, 'utf-8'),
            fs.promises.readFile(jsonSchemaPath, 'utf-8')
        ]);

        const jsonBandcampData = JSON.parse(rawFileData);
        const jsonBandcampSchema = JSON.parse(rawSchemaData);

        const schemaValidator = ajv.compile(jsonBandcampSchema);
        const isValidData = schemaValidator(jsonBandcampData);

        if (!isValidData) {
            console.warn(msgObjConsole.JSONVALIDATION, JSON.stringify(schemaValidator.errors, null, 4));

            return res.status(400).json({
                ok: false,
                error: msgObjStatusReturn.JSON_INVALID
            });
        }
        else {
            const fullHTML = createBandcampLinks(jsonBandcampData);
            return res.json({ html: fullHTML });
        }
    }
    catch (err) {
        console.error(msgObjConsole.JSONREADERR + err);

        return res.status(500).json({
            ok: false,
            error: msgObjStatusReturn.SRVR_ERROR
        });
    }
});

// Contact form endpoint
app.post('/api/contacts', async (req, res) => {
    try {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';

        if (isRateLimited(ip)) {
            return res.status(429).json({
                ok: false,
                error: msgObjStatusReturn.LIMIT_EXCEED
            });
        }

        const { name, email, message, recipient } = req.body || {};
        if (!name || !email || !message) {
            return res.status(400).json({
                ok: false,
                error: msgObjStatusReturn.FIELDS_MISSING
            });
        }

        // Validate the email using the validator package
        const sanitizedEmail = validator.normalizeEmail(email);
        if (!validator.isEmail(sanitizedEmail)) {
            return res.status(400).json({
                ok: false,
                error: msgObjStatusReturn.EMAIL_INVALID
            });
        }

        if (typeof message !== 'string' || message.trim().length < 20) {
            return res.status(400).json({
                ok: false, error:
                    msgObjStatusReturn.MSG_LENGTH_SHORT
            });
        }

        if (!mailerConnectAuth) {
            // If mailer isn't configured, still accept and respond but indicate service unavailable
            console.warn(msgObjConsole.MAILERNOAUTH);

            return res.status(503).json({
                ok: false,
                error: msgObjStatusReturn.SRVC_UNAVAILABLE
            });
        }

        // Determine recipient address: prefer explicit recipient from form if it's allowed
        let toAddress = mailerUserTo || mailerUserFrom || email;
        try {
            if (recipient && typeof recipient === 'string' && validator.isEmail(recipient)) {
                const rcpt = recipient.trim();
                if (ALLOWED_RECIPIENTS.length === 0 || ALLOWED_RECIPIENTS.includes(rcpt)) {
                    toAddress = rcpt;
                } else {
                    console.warn(`Contact attempt to unknown recipient: ${rcpt}. Falling back to default recipient.`);
                }
            }
        } catch (e) {
            console.warn('Recipient validation failed, using default recipient.', e);
        }

        const mailOptions = {
            from: mailerUserFrom || email,
            to: toAddress,
            replyTo: email || "",
            subject: `New contact message received`,
            text: `New contact message received on ${websiteDomain}:\n\nContact Name: ${name}\nContact Email: ${email}\nContact Message: ${message}\n\nReply to the sender to respond.`
        };

        const info = await mailTransporter.sendMail(mailOptions);

        // If using a test account (Ethereal), log the preview URL so developer can inspect the message
        let previewUrl = null;
        try {
            previewUrl = mailer.getTestMessageUrl ? mailer.getTestMessageUrl(info) : null;

            if (previewUrl) console.log(msgObjConsole.PREVIEWMSG + previewUrl);
        }
        catch (e) {
            console.log(`There was an error logging the Ethereal preview URL: ${e}`);
        }

        console.log(`The email was successfully sent by nodemailer! This was the SMTP server response: ${info.response}`);

        const responsePayload = {
            ok: true,
            message: msgObjStatusReturn.MSG_SUCCESS
        };

        // In non-production (dev) include Ethereal preview URL to help developers
        if (!isProduction && previewUrl) responsePayload.preview = previewUrl;

        return res.status(200).json(responsePayload);
    }
    catch (err) {
        console.error(msgObjConsole.POSTERR, err);

        return res.status(500).json({
            ok: false,
            error: msgObjStatusReturn.SRVR_ERROR
        });
    }
});

// SPA fallback using a middleware to avoid path-to-regexp issues
app.use((req, res, next) => {
    // In production mode serve the SPA index.html for all non-API GET requests
    if (isProduction) {
        if (req.method !== 'GET') return next();

        if (req.path.startsWith('/api')) return next();

        if (path.extname(req.path)) return next();

        const indexFile = path.join(staticDir, 'index.html');

        return res.sendFile(indexFile, (err) => {
            if (err) return next();
        });
    }
    // Not production: continue to next middleware/route
    return next();
});


/** Server entry point — only start listening when not under test */
if (!isTestRunner) {
    app.listen(PORT, () => {
        console.log(`The server has started. It is running on http://localhost:${PORT}`);
        console.log(`For troubleshooting purposes, here are the ENV variables being used:
            NODE_ENV: ${process.env.NODE_ENV}\n
            PORT: ${process.env.PORT}\n
            EMAIL_FROM_USER: ${process.env.EMAIL_FROM_USER}\n
            EMAIL_TO_USER: ${process.env.EMAIL_TO_USER}\n
            EMAIL_SERVICE_NAME: ${process.env.EMAIL_SERVICE_NAME}\n
            FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    });
}

export default app;
