import nextEnv from "@next/env";
import { Resend } from "resend";

const { loadEnvConfig } = nextEnv;

const CONFIRMATION_FLAG = "--confirm-send-one-development-email";
const SUBJECT = "[DEV] Manila Auto Pros — Email Test.";
const IDEMPOTENCY_KEY = "manila-auto-pros-development-email-test-v1";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FROM_PATTERN = /^(?:[^\r\n<>]{1,100}\s+<)?([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>?$/;

function fail(message) {
  throw new Error(`RESEND_TEST_CONFIGURATION_ERROR: ${message}`);
}

function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function validateEmail(value, name) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !EMAIL_PATTERN.test(normalized) ||
    /[\r\n]/.test(normalized)
  ) {
    fail(`${name} is not a valid email address.`);
  }
  return normalized;
}

function validateFromAddress(value) {
  const trimmed = value.trim();
  const match = FROM_PATTERN.exec(trimmed);
  if (!match || trimmed.length > 320 || /[\r\n]/.test(trimmed)) {
    fail("RESEND_FROM_EMAIL is invalid.");
  }
  validateEmail(match[1], "RESEND_FROM_EMAIL");
  return trimmed;
}

function readTestConfiguration() {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    fail("This development-only script refuses production environments.");
  }

  const deliveryMode = process.env.EMAIL_DELIVERY_MODE?.trim() || "disabled";
  if (deliveryMode !== "disabled") {
    fail("EMAIL_DELIVERY_MODE must remain disabled for this standalone test.");
  }

  const apiKey = requiredEnvironmentValue("RESEND_API_KEY");
  if (!/^re_[A-Za-z0-9_-]{16,}$/.test(apiKey)) {
    fail("RESEND_API_KEY has an invalid format.");
  }

  return {
    apiKey,
    from: validateFromAddress(requiredEnvironmentValue("RESEND_FROM_EMAIL")),
    recipient: validateEmail(
      requiredEnvironmentValue("EMAIL_TEST_RECIPIENT"),
      "EMAIL_TEST_RECIPIENT"
    ),
  };
}

function renderHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0;background:#111111;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111111;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#090909;border:1px solid #2b2b2b;border-radius:12px;overflow:hidden;">
            <tr><td style="height:6px;background:#d71920;"></td></tr>
            <tr>
              <td style="padding:36px 32px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d71920;">Manila Auto Pros</div>
                <h1 style="margin:14px 0 12px;font-size:28px;line-height:1.2;color:#ffffff;">Development email test</h1>
                <p style="margin:0;color:#c9c9c9;font-size:16px;line-height:1.7;">
                  The server-side Resend configuration is working. This message contains no booking, customer, or management-link data.
                </p>
                <div style="margin-top:28px;padding:16px;border-left:3px solid #d71920;background:#151515;color:#e8e8e8;font-size:14px;line-height:1.6;">
                  Development-only delivery verification. No booking notification workflow has been activated.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function main() {
  loadEnvConfig(process.cwd(), true, {
    info() {},
    error() {},
  });

  const args = process.argv.slice(2);
  const sendApproved = args.length === 1 && args[0] === CONFIRMATION_FLAG;
  if (args.length > 0 && !sendApproved) {
    fail(`The only accepted send flag is ${CONFIRMATION_FLAG}.`);
  }

  const config = readTestConfiguration();
  console.log("Resend development test configuration is valid.");
  console.log("Email delivery mode: disabled.");
  console.log("API key: configured and format-valid.");
  console.log("Sender: configured and syntax-valid.");
  console.log("Test recipient: configured and syntax-valid.");

  if (!sendApproved) {
    console.log("Validation only: no email was sent.");
    console.log(`To send exactly one test email, rerun with ${CONFIRMATION_FLAG}.`);
    return;
  }

  const resend = new Resend(config.apiKey);
  const { data, error } = await resend.emails.send(
    {
      from: config.from,
      to: [config.recipient],
      subject: SUBJECT,
      html: renderHtml(),
      text: "Manila Auto Pros development email test. The server-side Resend configuration is working. No booking notification workflow has been activated.",
    },
    { idempotencyKey: IDEMPOTENCY_KEY }
  );

  if (error) {
    throw new Error(
      `RESEND_TEST_SEND_ERROR: Resend rejected the request (${error.name || "unknown error"}).`
    );
  }

  console.log("Exactly one development test email was accepted by Resend.");
  if (data?.id) console.log(`Resend message ID: ${data.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Resend test failed.");
  process.exitCode = 1;
});
