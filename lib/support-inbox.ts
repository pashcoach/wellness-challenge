export type SupportInboxView = "active" | "archived";

type SupportMessage = {
  status: "new" | "in_progress" | "resolved";
};

export function supportMessagesForView<T extends SupportMessage>(
  messages: readonly T[],
  view: SupportInboxView,
): T[] {
  return messages.filter((message) =>
    view === "archived" ? message.status === "resolved" : message.status !== "resolved",
  );
}
