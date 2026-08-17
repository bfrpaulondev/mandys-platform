import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = path.resolve(process.cwd(), "supabase/functions");
const forbiddenPatterns = [
  { name: "database connection URI", pattern: /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/i },
  { name: "Supabase service role assignment", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'`][^"'`]+/i },
  { name: "OpenAI secret assignment", pattern: /OPENAI_API_KEY\s*=\s*["'`][^"'`]+/i },
  { name: "Cloudinary secret assignment", pattern: /CLOUDINARY_API_SECRET\s*=\s*["'`][^"'`]+/i },
  { name: "Stripe secret assignment", pattern: /STRIPE_SECRET_KEY\s*=\s*["'`][^"'`]+/i },
  { name: "Resend secret assignment", pattern: /RESEND_API_KEY\s*=\s*["'`][^"'`]+/i },
];

async function directories(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function formatDiagnostic(diagnostic, fileName) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (diagnostic.start === undefined) return `${fileName}: ${message}`;
  const source = diagnostic.file;
  if (!source) return `${fileName}: ${message}`;
  const position = source.getLineAndCharacterOfPosition(diagnostic.start);
  return `${fileName}:${position.line + 1}:${position.character + 1}: ${message}`;
}

async function main() {
  const functionNames = await directories(root);
  if (functionNames.length === 0) throw new Error("No Supabase Edge Functions found");

  const failures = [];
  for (const functionName of functionNames) {
    const directory = path.join(root, functionName);
    const indexPath = path.join(directory, "index.ts");
    const denoPath = path.join(directory, "deno.json");

    let source;
    try {
      source = await readFile(indexPath, "utf8");
    } catch {
      failures.push(`${functionName}: missing index.ts`);
      continue;
    }

    try {
      JSON.parse(await readFile(denoPath, "utf8"));
    } catch {
      failures.push(`${functionName}: missing or invalid deno.json`);
    }

    const result = ts.transpileModule(source, {
      fileName: indexPath,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        strict: true,
      },
    });

    for (const diagnostic of result.diagnostics ?? []) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        failures.push(formatDiagnostic(diagnostic, path.relative(process.cwd(), indexPath)));
      }
    }

    for (const { name, pattern } of forbiddenPatterns) {
      if (pattern.test(source)) failures.push(`${functionName}: possible committed ${name}`);
    }
  }

  if (failures.length > 0) {
    console.error("Supabase Edge Function validation failed:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${functionNames.length} Supabase Edge Functions: syntax, deno.json and basic secret scanning passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
