import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "structured-llm starter",
  description: "Next.js starter app for structured-llm",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff" }}>{children}</body>
    </html>
  );
}
