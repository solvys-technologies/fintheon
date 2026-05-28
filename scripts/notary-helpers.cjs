const fs = require("node:fs");

function getNotaryArgs() {
  if (process.env.APPLE_KEYCHAIN_PROFILE) {
    return ["--keychain-profile", process.env.APPLE_KEYCHAIN_PROFILE];
  }

  if (
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER
  ) {
    return [
      "--key",
      process.env.APPLE_API_KEY,
      "--key-id",
      process.env.APPLE_API_KEY_ID,
      "--issuer",
      process.env.APPLE_API_ISSUER,
    ];
  }

  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return [
      "--apple-id",
      process.env.APPLE_ID,
      "--password",
      process.env.APPLE_APP_SPECIFIC_PASSWORD,
      "--team-id",
      process.env.APPLE_TEAM_ID,
    ];
  }

  return null;
}

function assertNotaryReady() {
  const args = getNotaryArgs();
  if (!args) {
    throw new Error(
      [
        "Notarization credentials are missing.",
        "Set APPLE_KEYCHAIN_PROFILE, or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER,",
        "or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID.",
      ].join(" "),
    );
  }

  if (args[0] === "--key" && !fs.existsSync(args[1])) {
    throw new Error(`APPLE_API_KEY file does not exist: ${args[1]}`);
  }

  return args;
}

module.exports = { assertNotaryReady, getNotaryArgs };
