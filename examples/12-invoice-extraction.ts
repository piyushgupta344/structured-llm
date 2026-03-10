// Invoice data extraction — parse invoice text into structured billing data
// Run: OPENAI_API_KEY=... npx tsx examples/12-invoice-extraction.ts

import OpenAI from "openai";
import { extract } from "../src/index.js";

const client = new OpenAI();

const invoiceText = `
INVOICE #INV-2024-00842

From: Acme Design Studio
      123 Creative Lane, Portland, OR 97201
      billing@acmedesign.com

To:   TechCorp Inc.
      456 Innovation Blvd, San Francisco, CA 94105
      accounts@techcorp.com

Issue Date: March 5, 2024
Due Date:   April 5, 2024

Services Rendered:
  Website redesign (40 hrs @ $150/hr)     $6,000.00
  Brand identity package                  $2,500.00
  Monthly retainer (March 2024)           $1,200.00

Subtotal:   $9,700.00
Tax (8%):     $776.00
Total Due:  $10,476.00

Payment Terms: Net 30
Bank: First National Bank
Account: 1234567890
Routing: 021000021

Please include invoice number on payment.
`;

async function main() {
  const data = await extract({
    client,
    model: "gpt-4o-mini",
    prompt: invoiceText,
    fields: {
      invoiceNumber: { type: "string", description: "Invoice ID or number" },
      issueDate: { type: "date", description: "Date the invoice was issued" },
      dueDate: { type: "date", description: "Payment due date" },
      vendorName: { type: "string", description: "Name of the company issuing the invoice" },
      vendorEmail: { type: "email", description: "Vendor email address" },
      clientName: { type: "string", description: "Name of the billed client" },
      subtotal: { type: "number", description: "Subtotal before tax" },
      taxAmount: { type: "number", description: "Tax amount" },
      totalAmount: { type: "number", description: "Total amount due", required: true },
      paymentTerms: { type: "string", description: "e.g. Net 30" },
      currency: { type: "string", description: "Currency code, default USD if not specified" },
    },
    requireAll: false,
  });

  console.log("Extracted invoice data:");
  console.log(`  Invoice #: ${data.invoiceNumber}`);
  console.log(`  Issued:    ${data.issueDate}`);
  console.log(`  Due:       ${data.dueDate}`);
  console.log(`  Vendor:    ${data.vendorName} (${data.vendorEmail})`);
  console.log(`  Client:    ${data.clientName}`);
  console.log(`  Subtotal:  $${data.subtotal}`);
  console.log(`  Tax:       $${data.taxAmount}`);
  console.log(`  Total:     $${data.totalAmount}`);
  console.log(`  Terms:     ${data.paymentTerms}`);
}

main().catch(console.error);
