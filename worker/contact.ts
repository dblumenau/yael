export type ContactInput = {
  contactName: string;
  email: string;
  comments: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseContact(body: unknown): { ok: true; value: ContactInput } | { ok: false; errors: string[] } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const contactName = str(raw.contactName);
  const email = str(raw.email);
  const comments = str(raw.comments);
  const errors: string[] = [];
  if (!contactName || contactName.length > 200) errors.push("Please enter your name");
  if (!EMAIL.test(email) || email.length > 320) errors.push("Invalid email address");
  if (!comments || comments.length > 2000) errors.push("Please enter a message of up to 2000 characters");
  return errors.length ? { ok: false, errors } : { ok: true, value: { contactName, email, comments } };
}
