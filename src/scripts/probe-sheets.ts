import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { google } from "googleapis";

async function main() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const credPath = resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
      "credentials/google-service-account.json"
  );

  console.log("Spreadsheet ID:", id ?? "(missing)");
  console.log("Credentials file:", credPath);
  console.log("Credentials exist:", existsSync(credPath));

  if (!id || !existsSync(credPath)) {
    process.exit(1);
  }

  const creds = JSON.parse(readFileSync(credPath, "utf-8")) as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const tabs = meta.data.sheets?.map((s) => s.properties?.title) ?? [];

    console.log("Title:", meta.data.properties?.title);
    console.log("Tabs:", tabs.join(" | "));

    for (const title of tabs) {
      if (!title) continue;
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: `'${title.replace(/'/g, "''")}'!A:M`,
      });
      const rows = res.data.values ?? [];
      console.log(`\n--- ${title}: ${Math.max(0, rows.length - 1)} data rows ---`);
      for (const [i, row] of rows.slice(0, 4).entries()) {
        console.log(`  ${i}: ${JSON.stringify(row)}`);
      }
      if (rows.length > 4) {
        console.log(`  ... latest: ${JSON.stringify(rows[rows.length - 1])}`);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error("ERROR:", message);
    process.exit(1);
  }
}

main();
