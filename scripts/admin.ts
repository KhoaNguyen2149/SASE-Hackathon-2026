import { randomUUID } from "node:crypto";
import { one, run, transaction } from "../src/server/db";
const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: npm run db:admin -- student@example.com (register and verify first)",
  );
  process.exit(1);
}
const user = one<{ id: string; verified: number }>(
  "SELECT id,verified FROM users WHERE email=?",
  email.toLowerCase(),
);
if (!user?.verified) {
  console.error(
    "Register and verify this account before granting administration access.",
  );
  process.exit(1);
}
transaction(() => {
  run("UPDATE users SET role='admin' WHERE id=?", user.id);
  run(
    "INSERT INTO audit VALUES(?,?,?,?,?,?)",
    randomUUID(),
    user.id,
    "admin:grant",
    user.id,
    "Granted by server operator through the administration CLI.",
    Date.now(),
  );
});
console.log("Administrator access granted to the specified verified account.");
