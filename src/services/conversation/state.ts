export const ConversationState = {
  IDLE: "idle",
  PARSING: "parsing",
  PREVIEW: "preview",
  AWAITING_CONFIRM: "awaiting_confirm",
  POSTING: "posting",
  DONE: "done",
} as const;

export type ConversationStateType =
  (typeof ConversationState)[keyof typeof ConversationState];

export interface ConversationContext {
  invoiceJobId?: string;
  lastDraftHash?: string;
  pendingPdfUrl?: string;
}

export function isConfirmCommand(text: string): boolean {
  const t = text.trim().toUpperCase();
  return ["ONAYLA", "ONAY", "EVET", "YES", "OK"].includes(t);
}

export function isCancelCommand(text: string): boolean {
  const t = text.trim().toUpperCase();
  return ["İPTAL", "IPTAL", "CANCEL", "HAYIR", "NO"].includes(t);
}

export function isHelpCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["yardım", "yardim", "help", "?", "merhaba", "selam"].includes(t);
}
