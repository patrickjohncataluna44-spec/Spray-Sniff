const fs = require("fs");
const path = require("path");
const https = require("https");

const PAYMONGO_API_BASE_URL = "https://api.paymongo.com";
const DEFAULT_RETURN_URL = "https://example.com/payment/complete";
const DEFAULT_AMOUNT = 10000;

const TEST_CARD_PRESETS = {
  success: {
    label: "Successful non-3DS payment",
    card_number: "4343434343434345",
    exp_month: 12,
    exp_year: 2030,
    cvc: "123",
  },
  "3ds-success": {
    label: "3DS payment that should succeed after authorization",
    card_number: "4120000000000007",
    exp_month: 12,
    exp_year: 2030,
    cvc: "123",
  },
  expired: {
    label: "Expired card test",
    card_number: "4200000000000018",
    exp_month: 12,
    exp_year: 2030,
    cvc: "123",
  },
  invalid_cvc: {
    label: "Invalid CVC test",
    card_number: "4300000000000017",
    exp_month: 12,
    exp_year: 2030,
    cvc: "123",
  },
  insufficient_funds: {
    label: "Insufficient funds test",
    card_number: "5100000000000198",
    exp_month: 12,
    exp_year: 2030,
    cvc: "123",
  },
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const SECRET_KEY = getEnv("PAYMONGO_SECRET_KEY");
const PUBLIC_KEY = getEnv("NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY");
const PAYMONGO_ENVIRONMENT = resolvePaymongoEnvironment();
const ACCOUNT_ID = getEnv("PAYMONGO_ACCOUNT_ID") || getEnv("PAYMONGO_ACCOUNT");
const AMOUNT = Number(getEnv("PAYMONGO_TEST_AMOUNT") || DEFAULT_AMOUNT);
const RETURN_URL = getEnv("PAYMONGO_TEST_RETURN_URL") || DEFAULT_RETURN_URL;
const REQUESTED_METHOD = (process.argv[2] || getEnv("PAYMONGO_TEST_METHOD") || "auto").trim().toLowerCase();
const CARD_SCENARIO = (process.argv[3] || getEnv("PAYMONGO_TEST_SCENARIO") || "success").trim();
const TEST_CARD = resolveTestCard(CARD_SCENARIO);

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getEnv(key) {
  return process.env[key]?.trim() || "";
}

function getKeyEnvironment(key, keyType) {
  const livePrefix = keyType === "secret" ? "sk_live_" : "pk_live_";
  const testPrefix = keyType === "secret" ? "sk_test_" : "pk_test_";

  if (key.startsWith(livePrefix)) {
    return "live";
  }

  if (key.startsWith(testPrefix)) {
    return "test";
  }

  return null;
}

function resolvePaymongoEnvironment() {
  if (!SECRET_KEY) {
    return null;
  }

  const secretEnvironment = getKeyEnvironment(SECRET_KEY, "secret");

  if (!secretEnvironment) {
    return null;
  }

  if (!PUBLIC_KEY) {
    return secretEnvironment;
  }

  const publicEnvironment = getKeyEnvironment(PUBLIC_KEY, "public");

  if (!publicEnvironment || publicEnvironment !== secretEnvironment) {
    return null;
  }

  return secretEnvironment;
}

function formatEnvironmentLabel(environment) {
  return environment ? environment.toUpperCase() : "UNKNOWN";
}

function resolveTestCard(scenario) {
  const preset = TEST_CARD_PRESETS[scenario];

  if (preset) {
    return preset;
  }

  return {
    label: "Custom card from environment",
    card_number: getEnv("PAYMONGO_TEST_CARD_NUMBER") || TEST_CARD_PRESETS.success.card_number,
    exp_month: Number(getEnv("PAYMONGO_TEST_CARD_EXP_MONTH") || TEST_CARD_PRESETS.success.exp_month),
    exp_year: Number(getEnv("PAYMONGO_TEST_CARD_EXP_YEAR") || TEST_CARD_PRESETS.success.exp_year),
    cvc: getEnv("PAYMONGO_TEST_CARD_CVC") || TEST_CARD_PRESETS.success.cvc,
  };
}

function paymongoRequest(apiPath, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${SECRET_KEY}:`).toString("base64");
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: "api.paymongo.com",
      path: apiPath,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    };

    if (data) {
      options.headers["Content-Length"] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let raw = "";

      res.on("data", (chunk) => {
        raw += chunk;
      });

      res.on("end", () => {
        let parsed = {};

        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            reject(new Error(`Invalid JSON response from ${apiPath}: ${raw}`));
            return;
          }
        }

        resolve({
          statusCode: res.statusCode || 0,
          data: parsed,
        });
      });
    });

    req.on("error", (error) => reject(error));

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

function getErrorMessage(payload, fallback) {
  const firstError = payload?.errors?.[0];

  return (
    firstError?.detail ||
    firstError?.code ||
    payload?.message ||
    fallback
  );
}

function sanitizeForLog(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, sanitizeForLog(entryValue)])
    );
  }

  if (typeof value === "string" && value.startsWith("data:image/") && value.length > 160) {
    return `${value.slice(0, 80)}... [truncated ${value.length} chars]`;
  }

  return value;
}

function printPayload(label, payload) {
  console.log(`${label}:`);
  console.log(JSON.stringify(sanitizeForLog(payload), null, 2));
}

function ensurePaymongoCredentials() {
  if (!SECRET_KEY) {
    throw new Error("Missing PAYMONGO_SECRET_KEY. Add it to .env or .env.local.");
  }

  if (!PAYMONGO_ENVIRONMENT) {
    throw new Error(
      "PayMongo keys must use matching environments and valid prefixes (sk_live_/sk_test_ and pk_live_/pk_test_)."
    );
  }

  if (!Number.isInteger(AMOUNT) || AMOUNT <= 0) {
    throw new Error("PAYMONGO_TEST_AMOUNT must be a positive integer in centavos.");
  }
}

async function checkAccountIfConfigured() {
  if (!ACCOUNT_ID) {
    console.log("\n[1] Skipping optional /v2/accounts auth check.");
    console.log("Set PAYMONGO_ACCOUNT_ID if you want to test that endpoint too.");
    return;
  }

  console.log("\n[1] Checking account/auth via /v2/accounts...");
  const response = await paymongoRequest(`/v2/accounts/${ACCOUNT_ID}`, "GET");

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Account auth check failed."));
  }
}

async function checkMerchantCapabilities() {
  console.log("\n[2] Checking merchant payment method capabilities...");
  const response = await paymongoRequest("/v1/merchants/capabilities/payment_methods", "GET");

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Unable to read merchant capabilities."));
  }

  const methods = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.data)
    ? response.data.data
    : response.data?.data?.attributes?.payment_methods || [];

  console.log("Enabled methods:", methods.length ? methods.join(", ") : "(none)");

  return methods;
}

function selectPaymentMethod(methods) {
  if (REQUESTED_METHOD !== "auto") {
    if (!methods.includes(REQUESTED_METHOD)) {
      throw new Error(
        `Requested method "${REQUESTED_METHOD}" is not enabled on this account. Enabled methods: ${methods.join(", ")}`
      );
    }

    return REQUESTED_METHOD;
  }

  if (methods.includes("qrph")) {
    return "qrph";
  }

  if (methods.includes("card")) {
    return "card";
  }

  throw new Error(`No supported method found. Enabled methods: ${methods.join(", ") || "(none)"}`);
}

async function createPaymentIntent(paymentMethodType) {
  console.log(`\n[3] Creating payment intent for ${paymentMethodType}...`);

  const attributes = {
    amount: AMOUNT,
    currency: "PHP",
    payment_method_allowed: [paymentMethodType],
    capture_type: "automatic",
  };

  if (paymentMethodType === "card") {
    attributes.payment_method_options = {
      card: {
        request_three_d_secure: "automatic",
      },
    };
  }

  const body = {
    data: {
      attributes,
    },
  };

  const response = await paymongoRequest("/v1/payment_intents", "POST", body);

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Failed to create payment intent."));
  }

  const paymentIntentId = response.data?.data?.id;
  const clientKey = response.data?.data?.attributes?.client_key;

  if (!paymentIntentId) {
    throw new Error("Payment intent ID is missing from the response.");
  }

  return { paymentIntentId, clientKey };
}

async function createPaymentMethod(paymentMethodType) {
  if (paymentMethodType === "card") {
    console.log(`\n[4] Creating card payment method for scenario: ${CARD_SCENARIO} (${TEST_CARD.label})...`);
  } else {
    console.log(`\n[4] Creating ${paymentMethodType} payment method...`);
  }

  const attributes = {
    type: paymentMethodType,
    billing: {
      name: "Test User",
      email: "test@example.com",
      phone: "+639171234567",
      address: {
        line1: "123 Test Street",
        city: "Makati",
        state: "Metro Manila",
        postal_code: "1200",
        country: "PH",
      },
    },
  };

  if (paymentMethodType === "card") {
    attributes.details = {
      card_number: TEST_CARD.card_number,
      exp_month: TEST_CARD.exp_month,
      exp_year: TEST_CARD.exp_year,
      cvc: TEST_CARD.cvc,
    };
  }

  const body = {
    data: {
      attributes,
    },
  };

  const response = await paymongoRequest("/v1/payment_methods", "POST", body);

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Failed to create payment method."));
  }

  const paymentMethodId = response.data?.data?.id;

  if (!paymentMethodId) {
    throw new Error("Payment method ID is missing from the response.");
  }

  return paymentMethodId;
}

async function attachPaymentMethod(paymentIntentId, paymentMethodId, clientKey, paymentMethodType) {
  console.log("\n[5] Attaching payment method to payment intent...");

  const body = {
    data: {
      attributes: {
        payment_method: paymentMethodId,
        return_url: RETURN_URL,
      },
    },
  };

  if (clientKey) {
    body.data.attributes.client_key = clientKey;
  }

  const response = await paymongoRequest(
    `/v1/payment_intents/${paymentIntentId}/attach`,
    "POST",
    body
  );

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Failed to attach payment method."));
  }

  const status = response.data?.data?.attributes?.status;
  const redirectUrl = response.data?.data?.attributes?.next_action?.redirect?.url;
  const qrImageUrl = response.data?.data?.attributes?.next_action?.code?.image_url;

  if (status === "awaiting_next_action" && redirectUrl) {
    console.log("\n[INFO] This card requires 3DS authentication.");
    console.log("Open this URL in a browser, finish the test auth step, then run the script again or fetch the payment intent:");
    console.log(redirectUrl);
  }

  if (paymentMethodType === "qrph" && qrImageUrl) {
    console.log("\n[INFO] QRPH code generated successfully.");
    if (PAYMONGO_ENVIRONMENT === "live") {
      console.log("[WARN] This is a live QR code. Completing the scan will create a real payment.");
    } else {
      console.log("This is a test-mode QR. Do not complete the payment unless you are intentionally validating the sandbox flow.");
    }
    console.log(`QR image URL length: ${qrImageUrl.length}`);
  }

  return response.data;
}

async function getPaymentIntent(paymentIntentId) {
  console.log("\n[6] Fetching final payment intent status...");

  const response = await paymongoRequest(`/v1/payment_intents/${paymentIntentId}`, "GET");

  console.log("HTTP Status:", response.statusCode);
  printPayload("Response", response.data);

  if (response.statusCode >= 400) {
    throw new Error(getErrorMessage(response.data, "Failed to fetch payment intent."));
  }

  return response.data?.data?.attributes?.status || "unknown";
}

async function main() {
  try {
    ensurePaymongoCredentials();

    console.log("========================================");
    console.log(`PayMongo ${formatEnvironmentLabel(PAYMONGO_ENVIRONMENT)} mode verification`);
    console.log("========================================");
    console.log("API base:", PAYMONGO_API_BASE_URL);
    console.log("Requested method:", REQUESTED_METHOD);
    console.log("Card scenario:", CARD_SCENARIO);
    console.log("Amount:", AMOUNT, `(PHP ${(AMOUNT / 100).toFixed(2)})`);
    console.log("Environment:", PAYMONGO_ENVIRONMENT);
    console.log("Public key loaded:", PUBLIC_KEY ? "yes" : "no");

    await checkAccountIfConfigured();
    const methods = await checkMerchantCapabilities();
    const paymentMethodType = selectPaymentMethod(methods);

    console.log("Using method:", paymentMethodType);

    if (paymentMethodType !== "card") {
      console.log(
        "[INFO] Card flow is not enabled on this account. The script will use the currently available method instead."
      );
    }

    const { paymentIntentId, clientKey } = await createPaymentIntent(paymentMethodType);
    const paymentMethodId = await createPaymentMethod(paymentMethodType);
    await attachPaymentMethod(paymentIntentId, paymentMethodId, clientKey, paymentMethodType);

    const finalStatus = await getPaymentIntent(paymentIntentId);

    console.log("\n========================================");
    console.log("FINAL STATUS:", finalStatus);
    console.log("========================================");

    if (finalStatus === "succeeded") {
      console.log(`[SUCCESS] Working ang imong PayMongo ${formatEnvironmentLabel(PAYMONGO_ENVIRONMENT)} API flow.`);
      return;
    }

    if (finalStatus === "awaiting_next_action") {
      if (paymentMethodType === "qrph") {
        if (PAYMONGO_ENVIRONMENT === "live") {
          console.log("[INFO] QRPH code is ready. Completing it will create a real payment.");
        } else {
          console.log("[INFO] QRPH code is ready. Expected ni sa test mode unless i-complete nimo ang QR payment.");
        }
      } else {
        console.log("[INFO] Naa pa sa 3DS step. Complete the redirect flow first.");
      }
      return;
    }

    if (finalStatus === "awaiting_payment_method") {
      console.log("[INFO] Payment method was not accepted. This is expected for some failure test cards.");
      return;
    }

    console.log("[INFO] Payment did not end in succeeded. Check the response above for details.");
  } catch (error) {
    console.error("\n[ERROR]", error.message);
    process.exitCode = 1;
  }
}

main();
