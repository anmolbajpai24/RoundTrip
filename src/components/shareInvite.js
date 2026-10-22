import { joinUrl } from "../lib/joinLink.js";
import { APP_NAME } from "../theme.js";
import { toast } from "./dialogs.jsx";

// Invites always carry the join link: tapping it in WhatsApp opens the trip
// directly. The code stays in the text as the fallback for anyone typing it.
export function inviteText(title, code) {
  const name = (title || "").trim();
  return `Join ${name ? `"${name}"` : "my trip"} on ${APP_NAME}: ${joinUrl(code)} (or enter code ${code})`;
}

export async function copyInviteLink(code) {
  try { await navigator.clipboard.writeText(joinUrl(code)); toast("Link copied"); }
  catch { /* clipboard unsupported */ }
}

// Native share sheet where there is one, otherwise copy the whole invite.
export async function shareInvite(title, code) {
  const text = inviteText(title, code);
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("Invite copied"); }
  } catch { /* cancelled or unsupported */ }
}
