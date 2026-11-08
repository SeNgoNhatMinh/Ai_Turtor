const fs = require("fs");
const { execFileSync } = require("child_process");

const apiKey = process.env.GROQ_API_KEY || "";
if (!apiKey) {
  console.error("GROQ_API_KEY is empty in the n8n container");
  process.exit(1);
}

const payload = [{
  id: "groqHarnessAgent",
  name: "Groq Harness",
  type: "groqApi",
  data: { apiKey },
}];
fs.writeFileSync("/tmp/groq-cred.json", JSON.stringify(payload));
execFileSync("n8n", ["import:credentials", "--input=/tmp/groq-cred.json"], { stdio: "inherit" });
fs.unlinkSync("/tmp/groq-cred.json");
console.log("groq-credential-imported");
