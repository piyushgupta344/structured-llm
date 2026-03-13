// API spec extraction — generate OpenAPI-style schema from natural language descriptions
// Run: OPENAI_API_KEY=... npx tsx examples/25-api-spec-extraction.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const APISpecSchema = z.object({
  title: z.string(),
  version: z.string(),
  baseUrl: z.string().optional(),
  endpoints: z.array(
    z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string(),
      summary: z.string(),
      description: z.string().optional(),
      auth: z.enum(["none", "bearer", "api_key", "basic", "oauth2"]),
      pathParams: z.array(
        z.object({ name: z.string(), type: z.string(), description: z.string().optional() })
      ),
      queryParams: z.array(
        z.object({ name: z.string(), type: z.string(), required: z.boolean(), description: z.string().optional() })
      ),
      requestBody: z
        .object({
          contentType: z.string(),
          fields: z.array(
            z.object({ name: z.string(), type: z.string(), required: z.boolean(), description: z.string().optional() })
          ),
        })
        .optional(),
      responses: z.array(
        z.object({ statusCode: z.number(), description: z.string() })
      ),
    })
  ),
  authentication: z.object({
    type: z.enum(["none", "bearer", "api_key", "oauth2"]),
    description: z.string().optional(),
  }),
});

const apiDescription = `
User Management API

This REST API manages users and their authentication in our SaaS platform.
Base URL: https://api.example.com/v1

Authentication: Bearer token in Authorization header. Get tokens via /auth/login.

Endpoints:

1. Create a new user account (POST /users)
   - Required body: email (string), password (string, min 8 chars), name (string)
   - Optional body: role (string, default "user"), metadata (object)
   - Returns 201 with the created user object (no password)
   - Returns 409 if email already exists
   - No auth required

2. Get user by ID (GET /users/:id)
   - Requires bearer auth
   - Returns 200 with user object
   - Returns 404 if not found
   - Returns 403 if requesting user doesn't have permission

3. Update user (PATCH /users/:id)
   - Requires bearer auth (own user or admin)
   - Optional body fields: name, email, metadata
   - Returns 200 with updated user

4. Delete user (DELETE /users/:id)
   - Requires admin bearer token
   - Returns 204 on success
   - Returns 404 if not found

5. List users (GET /users)
   - Requires admin bearer token
   - Query params: page (int, default 1), limit (int, default 20, max 100),
     sort (string, e.g. "created_at:desc"), filter_role (string)
   - Returns 200 with { users: [...], total: number, page: number }

6. Login (POST /auth/login)
   - Body: email, password
   - Returns 200 with { token, expiresIn }
   - Returns 401 on bad credentials
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: APISpecSchema,
    prompt: apiDescription,
    systemPrompt: "Convert this API description into a structured OpenAPI-compatible specification.",
    temperature: 0,
  });

  console.log(`API: ${data.title} v${data.version}`);
  if (data.baseUrl) console.log(`Base URL: ${data.baseUrl}`);
  console.log(`Auth: ${data.authentication.type}`);

  console.log(`\nEndpoints (${data.endpoints.length}):`);
  data.endpoints.forEach((ep) => {
    console.log(`\n  ${ep.method} ${ep.path} [auth: ${ep.auth}]`);
    console.log(`    ${ep.summary}`);
    if (ep.pathParams.length) {
      console.log(`    Path params: ${ep.pathParams.map((p) => `${p.name}:${p.type}`).join(", ")}`);
    }
    if (ep.queryParams.length) {
      const req = ep.queryParams.filter((p) => p.required).map((p) => p.name);
      const opt = ep.queryParams.filter((p) => !p.required).map((p) => p.name);
      if (req.length) console.log(`    Required query: ${req.join(", ")}`);
      if (opt.length) console.log(`    Optional query: ${opt.join(", ")}`);
    }
    if (ep.requestBody) {
      const reqFields = ep.requestBody.fields.filter((f) => f.required).map((f) => f.name);
      const optFields = ep.requestBody.fields.filter((f) => !f.required).map((f) => f.name);
      if (reqFields.length) console.log(`    Required body: ${reqFields.join(", ")}`);
      if (optFields.length) console.log(`    Optional body: ${optFields.join(", ")}`);
    }
    console.log(`    Responses: ${ep.responses.map((r) => r.statusCode).join(", ")}`);
  });
}

main().catch(console.error);
