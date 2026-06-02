export interface InboundTextMessage {
  type: "text";
  from: string;
  messageId: string;
  text: string;
  timestamp: string;
}

export interface InboundDocumentMessage {
  type: "document";
  from: string;
  messageId: string;
  mediaId: string;
  mimeType?: string;
  filename?: string;
  timestamp: string;
}

export interface InboundImageMessage {
  type: "image";
  from: string;
  messageId: string;
  mediaId: string;
  timestamp: string;
}

export type InboundMessage =
  | InboundTextMessage
  | InboundDocumentMessage
  | InboundImageMessage;

export function parseWhatsAppWebhookBody(
  body: unknown,
): InboundMessage[] {
  const messages: InboundMessage[] = [];
  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<Record<string, unknown>>;
        };
      }>;
    }>;
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const from = String(msg.from ?? "");
        const messageId = String(msg.id ?? "");
        const timestamp = String(msg.timestamp ?? "");

        if (msg.type === "text" && msg.text && typeof msg.text === "object") {
          const textObj = msg.text as { body?: string };
          if (textObj.body) {
            messages.push({
              type: "text",
              from,
              messageId,
              text: textObj.body,
              timestamp,
            });
          }
        }

        if (msg.type === "document" && msg.document) {
          const doc = msg.document as {
            id?: string;
            mime_type?: string;
            filename?: string;
          };
          if (doc.id) {
            messages.push({
              type: "document",
              from,
              messageId,
              mediaId: doc.id,
              mimeType: doc.mime_type,
              filename: doc.filename,
              timestamp,
            });
          }
        }

        if (msg.type === "image" && msg.image) {
          const img = msg.image as { id?: string };
          if (img.id) {
            messages.push({
              type: "image",
              from,
              messageId,
              mediaId: img.id,
              timestamp,
            });
          }
        }
      }
    }
  }

  return messages;
}
