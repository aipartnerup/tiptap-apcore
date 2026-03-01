import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from demo/ directory (parent of server/)
dotenv.config({ path: resolve(__dirname, "../../.env") });

import { app } from "./app.js";

const port = parseInt(process.env.PORT || "3001", 10);

app.listen(port, () => {
  console.log(`tiptap-apcore demo server running on http://localhost:${port}`);
});
