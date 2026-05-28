const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const LABEL = "io.pricedinresearch.fintheon.blocker-helper";
const SOCKET_PATH = "/var/run/fintheon-blocker.sock";
const INSTALL_PATH = `/Library/PrivilegedHelperTools/${LABEL}`;
const PLIST_PATH = `/Library/LaunchDaemons/${LABEL}.plist`;

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function osascriptQuote(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function appBundleRoot(app) {
  const exePath = app.getPath("exe");
  if (!exePath.includes(".app/Contents/MacOS/")) return null;
  return exePath.slice(0, exePath.indexOf(".app/Contents/MacOS/") + 4);
}

function bundledPaths(app) {
  const appRoot = appBundleRoot(app);
  if (appRoot) {
    const dir = path.join(appRoot, "Contents", "Library", "LaunchServices");
    return {
      helper: path.join(dir, LABEL),
      plist: path.join(dir, `${LABEL}.plist`),
    };
  }
  const dir = path.join(__dirname, "privileged-helper", "build");
  return {
    helper: path.join(dir, LABEL),
    plist: path.join(dir, `${LABEL}.plist`),
  };
}

function sendHelperCommand(command, domains = []) {
  return new Promise((resolve) => {
    const client = net.createConnection(SOCKET_PATH);
    let data = "";
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      client.destroy();
      resolve(payload);
    };
    client.setTimeout(1800, () =>
      finish({ ok: false, reason: "helper timeout" }),
    );
    client.on("connect", () => {
      const line = [command, ...domains].join(" ").trim();
      client.write(`${line}\n`);
    });
    client.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (!data.includes("\n")) return;
      try {
        finish(JSON.parse(data.trim()));
      } catch {
        finish({ ok: false, reason: "helper response parse failed" });
      }
    });
    client.on("error", (error) =>
      finish({ ok: false, reason: error.message || "helper unavailable" }),
    );
    client.on("end", () => {
      if (data.trim()) {
        try {
          finish(JSON.parse(data.trim()));
          return;
        } catch {}
      }
      finish({ ok: false, reason: "helper disconnected" });
    });
  });
}

async function waitForHelper() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await sendHelperCommand("STATUS");
    if (status.ok) return status;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { ok: false, running: false, reason: "helper did not start" };
}

async function getBlockerHelperStatus() {
  const installed = fs.existsSync(INSTALL_PATH) && fs.existsSync(PLIST_PATH);
  const status = await sendHelperCommand("STATUS");
  return {
    ok: true,
    installed,
    running: !!status.ok,
    blocked: !!status.blocked,
    reason: status.ok ? undefined : status.reason,
  };
}

async function installBlockerHelper(app) {
  const bundled = bundledPaths(app);
  if (!fs.existsSync(bundled.helper) || !fs.existsSync(bundled.plist)) {
    return {
      ok: false,
      installed: false,
      running: false,
      reason: "bundled helper missing",
    };
  }

  const command = [
    "/bin/mkdir -p /Library/PrivilegedHelperTools /Library/Logs",
    `/bin/cp -f ${shellQuote(bundled.helper)} ${shellQuote(INSTALL_PATH)}`,
    `/usr/sbin/chown root:wheel ${shellQuote(INSTALL_PATH)}`,
    `/bin/chmod 755 ${shellQuote(INSTALL_PATH)}`,
    `/bin/cp -f ${shellQuote(bundled.plist)} ${shellQuote(PLIST_PATH)}`,
    `/usr/sbin/chown root:wheel ${shellQuote(PLIST_PATH)}`,
    `/bin/chmod 644 ${shellQuote(PLIST_PATH)}`,
    `(/bin/launchctl bootout system ${shellQuote(PLIST_PATH)} >/dev/null 2>&1 || true)`,
    `/bin/launchctl bootstrap system ${shellQuote(PLIST_PATH)}`,
    `/bin/launchctl kickstart -k system/${LABEL}`,
  ].join(" && ");

  try {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        `do shell script "${osascriptQuote(command)}" with administrator privileges`,
      ],
      { timeout: 60_000 },
    );
  } catch (error) {
    return {
      ok: false,
      installed: fs.existsSync(INSTALL_PATH),
      running: false,
      reason: error.message || "helper install cancelled",
    };
  }

  const status = await waitForHelper();
  return {
    ok: !!status.ok,
    installed: fs.existsSync(INSTALL_PATH),
    running: !!status.ok,
    blocked: !!status.blocked,
    reason: status.ok ? undefined : status.reason,
  };
}

async function enableBlockerWithHelper(domains) {
  const status = await getBlockerHelperStatus();
  if (!status.running) {
    return {
      ok: false,
      requiresInstall: true,
      reason: "system helper not approved",
    };
  }
  return sendHelperCommand("ENABLE", domains);
}

async function disableBlockerWithHelper(domains) {
  const status = await getBlockerHelperStatus();
  if (!status.running) {
    return {
      ok: false,
      requiresInstall: true,
      reason: "system helper not approved",
    };
  }
  return sendHelperCommand("DISABLE", domains);
}

module.exports = {
  installBlockerHelper,
  getBlockerHelperStatus,
  enableBlockerWithHelper,
  disableBlockerWithHelper,
};
