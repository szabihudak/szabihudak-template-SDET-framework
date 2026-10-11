// Minimal application stand-in for the template self-test. It implements only
// what the starter tests and doctor need: a page, NextAuth credentials login
// and bearer-token API login.
import http from "node:http";

const USER = { email: "user@example.com", password: "Password123!" };
const port = Number(process.env.MOCK_APP_PORT ?? 4510);

const page = (title, body) =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;

http
  .createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const { pathname } = new URL(request.url, "http://localhost");
      const signedIn = (request.headers.cookie ?? "").includes("session=ok");

      if (pathname === "/api/auth/csrf") {
        response.setHeader("content-type", "application/json");
        return response.end(JSON.stringify({ csrfToken: "csrf-token" }));
      }

      if (pathname === "/api/auth/callback/credentials") {
        const form = new URLSearchParams(body);
        const valid =
          form.get("csrfToken") === "csrf-token" &&
          form.get("email") === USER.email &&
          form.get("password") === USER.password;

        if (!valid) {
          response.statusCode = 401;
          return response.end("Invalid credentials");
        }

        response.setHeader("set-cookie", "session=ok; Path=/; HttpOnly");
        return response.end("ok");
      }

      if (pathname === "/api/auth/login" && request.method === "POST") {
        const credentials = JSON.parse(body || "{}");
        response.setHeader("content-type", "application/json");

        if (
          credentials.email !== USER.email ||
          credentials.password !== USER.password
        ) {
          response.statusCode = 401;
          return response.end(JSON.stringify({ error: "Unauthorized" }));
        }

        return response.end(JSON.stringify({ access_token: "token" }));
      }

      if (pathname === "/dashboard" && !signedIn) {
        response.statusCode = 302;
        response.setHeader("location", "/login");
        return response.end();
      }

      response.setHeader("content-type", "text/html");

      if (pathname === "/dashboard") {
        return response.end(page("Dashboard", "<p>Signed in.</p>"));
      }

      if (pathname === "/api") {
        response.setHeader("content-type", "application/json");
        return response.end(JSON.stringify({ status: "ok" }));
      }

      return response.end(page("Home", "<p>Self-test application.</p>"));
    });
  })
  .listen(port, () => console.log(`mock app listening on ${port}`));
