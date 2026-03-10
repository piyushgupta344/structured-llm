import { defineConfig } from "vitepress";

export default defineConfig({
  title: "structured-llm",
  description: "Zod-validated, fully-typed structured output from any LLM.",
  head: [
    ["meta", { name: "og:title", content: "structured-llm" }],
    ["meta", { name: "og:description", content: "Provider-agnostic structured output for TypeScript. Bring your own client." }],
    ["meta", { name: "theme-color", content: "#7c3aed" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "structured-llm",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API Reference", link: "/reference/generate" },
      { text: "Examples", link: "/examples/overview" },
      { text: "Playground", link: "/playground" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/structured-llm",
      },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/guide/introduction" },
          { text: "Quick Start", link: "/guide/getting-started" },
          { text: "Providers", link: "/guide/providers" },
          { text: "TypeScript Setup", link: "/guide/typescript" },
        ],
      },
      {
        text: "Core API",
        items: [
          { text: "generate()", link: "/reference/generate" },
          { text: "generateArray()", link: "/reference/generate-array" },
          { text: "generateStream()", link: "/reference/generate-stream" },
          { text: "generateBatch()", link: "/reference/generate-batch" },
          { text: "generateMultiSchema()", link: "/reference/generate-multi-schema" },
          { text: "createClient()", link: "/reference/create-client" },
        ],
      },
      {
        text: "Helpers",
        items: [
          { text: "classify()", link: "/reference/classify" },
          { text: "extract()", link: "/reference/extract" },
          { text: "createTemplate()", link: "/reference/create-template" },
          { text: "withCache()", link: "/reference/with-cache" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Extraction Modes", link: "/concepts/extraction-modes" },
          { text: "Retry Logic", link: "/concepts/retry" },
          { text: "Fallback Chain", link: "/concepts/fallback" },
          { text: "Usage Tracking", link: "/concepts/usage" },
          { text: "Hooks", link: "/concepts/hooks" },
          { text: "Custom Schemas", link: "/concepts/custom-schemas" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Overview", link: "/examples/overview" },
          { text: "Document Processing", link: "/examples/document-processing" },
          { text: "Classification", link: "/examples/classification" },
          { text: "Batch Processing", link: "/examples/batch" },
          { text: "Streaming", link: "/examples/streaming" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Migrating from instructor-js", link: "/guides/migrate-from-instructor" },
          { text: "Next.js Integration", link: "/guides/nextjs" },
          { text: "Error Handling", link: "/guides/error-handling" },
          { text: "Contributing", link: "/guides/contributing" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/piyushgupta344/structured-llm" },
      { icon: "npm", link: "https://www.npmjs.com/package/structured-llm" },
    ],

    editLink: {
      pattern: "https://github.com/piyushgupta344/structured-llm/edit/main/website/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024",
    },

    search: {
      provider: "local",
    },
  },
});
