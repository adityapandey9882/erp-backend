// import app from "./app.js";
// import { env } from "./config/env.js";
// import { initializeDatabase } from "./database/index.js";

// function describeDatabaseTarget(connectionString: string) {
//   try {
//     const url = new URL(connectionString);
//     const user = decodeURIComponent(url.username || "unknown");
//     const database = url.pathname.replace(/^\//, "");
//     const host = url.hostname || "localhost";
//     const port = url.port || "5432";

//     return `user "${user}" at ${host}:${port}${database ? `/${database}` : ""}`;
//   } catch {
//     return "the configured database";
//   }
// }

// function getStartupMessage(error: unknown) {
//   if (!error || typeof error !== "object") {
//     return "Failed to start Company Management ERP API.";
//   }

//   const nodeError = error as {
//     code?: string;
//     address?: string;
//     port?: number;
//   };

//   if (nodeError.code === "ECONNREFUSED") {
//     const host = nodeError.address ?? "localhost";
//     const port = nodeError.port ? `:${nodeError.port}` : "";

//     return `PostgreSQL connection refused at ${host}${port}. Check DATABASE_URL and make sure the database server is running.`;
//   }

//   if (nodeError.code === "28P01") {
//     return `PostgreSQL authentication failed for ${describeDatabaseTarget(env.databaseUrl)}. Update DATABASE_URL in backend/.env with the correct username and password.`;
//   }

//   if (nodeError.code === "EADDRINUSE") {
//     return `Port ${env.port} is already in use. Stop the existing backend process or change PORT in backend/.env.`;
//   }

//   return "Failed to start Company Management ERP API.";
// }

// async function startServer() {
//   await initializeDatabase();

//   const server = app.listen(env.port, () => {
//     console.log(`${env.appName} listening on port ${env.port}`);
//   });

//   server.on("error", (error) => {
//     console.error(getStartupMessage(error));
//     console.error(error);
//     process.exit(1);
//   });
// }

// void startServer().catch((error) => {
//   console.error(getStartupMessage(error));
//   console.error(error);
//   process.exit(1);
// });

import app from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./database/index.js";
import { networkInterfaces } from "node:os";

function describeDatabaseTarget(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const user = decodeURIComponent(url.username || "unknown");
    const database = url.pathname.replace(/^\//, "");
    const host = url.hostname || "localhost";
    const port = url.port || "5432";

    return `user "${user}" at ${host}:${port}${database ? `/${database}` : ""}`;
  } catch {
    return "the configured database";
  }
}

function getStartupMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Failed to start Company Management ERP API.";
  }

  const nodeError = error as {
    code?: string;
    address?: string;
    port?: number;
  };

  if (nodeError.code === "ECONNREFUSED") {
    const host = nodeError.address ?? "localhost";
    const port = nodeError.port ? `:${nodeError.port}` : "";

    return `PostgreSQL connection refused at ${host}${port}. Check DATABASE_URL and make sure the database server is running.`;
  }

  if (nodeError.code === "28P01") {
    return `PostgreSQL authentication failed for ${describeDatabaseTarget(env.databaseUrl)}. Update DATABASE_URL in backend/.env with the correct username and password.`;
  }

  if (nodeError.code === "EADDRINUSE") {
    return `Port ${env.port} is already in use. Stop the existing backend process or change PORT in backend/.env.`;
  }

  return "Failed to start Company Management ERP API.";
}

function getNetworkApiUrls(port: number) {
  const urls = new Set([`http://localhost:${port}/api/v1`]);

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.add(`http://${entry.address}:${port}/api/v1`);
      }
    }
  }

  return Array.from(urls);
}

async function startServer() {
  await initializeDatabase();

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(
      `${env.appName} API listening on all interfaces (0.0.0.0:${env.port})`,
    );
    console.log("Usable API URLs:");
    for (const url of getNetworkApiUrls(env.port)) {
      console.log(`- ${url}`);
    }
  });

  server.on("error", (error) => {
    console.error(getStartupMessage(error));
    console.error(error);
    process.exit(1);
  });
}

void startServer().catch((error) => {
  console.error(getStartupMessage(error));
  console.error(error);
  process.exit(1);
});
