import { Notification } from "@react-node-trpc-patterns/server/database/schema";

type NotificationWithContent = Notification & {
  content: string;
};

export type NotificationForList = NotificationWithContent;
