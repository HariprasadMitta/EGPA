import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js auto-loads .env.local, but plain dotenv only loads .env by
// default - the Prisma CLI isn't running inside Next's process, so it needs
// this pointed at .env.local explicitly to see DATABASE_URL.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
