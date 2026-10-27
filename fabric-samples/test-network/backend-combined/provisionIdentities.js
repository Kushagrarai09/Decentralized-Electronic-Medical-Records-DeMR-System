"use strict";

// Explicit operator-run identity provisioning. The API server does not run this
// automatically; choose an action deliberately to avoid unintended setup work.
const { enrollAdmin } = require("./enrollAdmin");
const { registerUser } = require("./registerUser");

const action = process.argv[2];

async function main() {
  if (action === "admin") {
    await enrollAdmin("admin");
    return;
  }

  if (action === "users") {
    for (const userType of ["admin1", "doctor", "patient"]) {
      await registerUser(userType);
    }
    return;
  }

  console.error(
    "Usage: node provisionIdentities.js <admin|users>\n" +
    "Run the admin enrollment first, then run user registration."
  );
  process.exitCode = 2;
}

main().catch((error) => {
  console.error("Identity provisioning failed:", error.message);
  process.exitCode = 1;
});
