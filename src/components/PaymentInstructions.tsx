import { useState } from "react";

const till = String(import.meta.env.VITE_MPESA_TILL ?? "").trim() || "6817863";
const paybill = String(import.meta.env.VITE_MPESA_PAYBILL ?? "").trim();
const account = String(import.meta.env.VITE_MPESA_ACCOUNT ?? "").trim();

export default function PaymentInstructions({ amount, purpose }: { amount: number; purpose: string }) {
  const [copied, setCopied] = useState(false);
  async function copyTill() {
    try {
      await navigator.clipboard.writeText(till);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the M-Pesa Till number:", till);
    }
  }
  return <div className="payment-instructions-card">
    <div><span className="eyebrow">M-PESA PAYMENT</span><strong>KSh {amount.toLocaleString()} · {purpose}</strong><p>{paybill ? `Paybill: ${paybill}${account ? ` · Account: ${account}` : ""}` : "Buy Goods & Services"}</p><p className="payment-till-value">Till number: <strong>{till}</strong></p></div>
    <button type="button" className="button button-outline payment-copy-button" onClick={() => void copyTill()}>{copied ? "Copied ✓" : "Copy Till Number"}</button>
  </div>;
}
