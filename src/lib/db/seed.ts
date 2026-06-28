import "dotenv/config";

console.error(
  "db:seed is deprecated — Kasulu now loads data from Wialon and Google Sheets.\n" +
    "  npm run db:clear   # optional: remove existing rows\n" +
    "  npm run sync       # pull live data from configured sources"
);
process.exit(1);
