import { supabase } from "../lib/supabase";

export type NotificationType = "info" | "update" | "feature" | "warning";

export type NotificationRow = {
  id: string;
  title: string;
  preview: string;
  message: string;
  type: string;
  is_active: boolean;
  created_at: string;
};

export type UserNotificationReadRow = {
  id: string;
  user_id: string;
  notification_id: string;
  read_at: string;
};

export type AppNotification = {
  id: string;
  title: string;
  preview: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
};

function normalizeType(type: string): NotificationType {
  if (type === "update") return "update";
  if (type === "feature") return "feature";
  if (type === "warning") return "warning";
  return "info";
}

async function getCurrentUserCreatedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Erro ao buscar usuário atual:", error);
    throw error;
  }

  const authUser = data.user;

  if (!authUser) return null;
  if (String(authUser.id) !== String(userId)) return null;

  return authUser.created_at ?? null;
}

export async function getActiveNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, preview, message, type, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar notifications:", error);
    throw error;
  }

  return data ?? [];
}

export async function getUserNotificationReads(userId: string): Promise<UserNotificationReadRow[]> {
  const { data, error } = await supabase
    .from("user_notification_reads")
    .select("id, user_id, notification_id, read_at")
    .eq("user_id", userId);

  console.log("[notifications] getUserNotificationReads userId:", userId);
  console.log("[notifications] getUserNotificationReads data:", data);
  console.log("[notifications] getUserNotificationReads error:", error);

  if (error) {
    console.error("Erro ao buscar leituras das notificações:", error);
    throw error;
  }

  return data ?? [];
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  const { data, error } = await supabase
    .from("user_notification_reads")
    .upsert(
      {
        user_id: userId,
        notification_id: notificationId,
        read_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,notification_id",
      }
    )
    .select();

  console.log("[notifications] markNotificationAsRead userId:", userId);
  console.log("[notifications] markNotificationAsRead notificationId:", notificationId);
  console.log("[notifications] markNotificationAsRead data:", data);
  console.log("[notifications] markNotificationAsRead error:", error);

  if (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    throw error;
  }

  return data;
}

export async function getNotificationsWithReadStatus(userId: string): Promise<AppNotification[]> {
  const [notifications, reads, userCreatedAt] = await Promise.all([
    getActiveNotifications(),
    getUserNotificationReads(userId),
    getCurrentUserCreatedAt(userId),
  ]);

  const readIds = new Set(reads.map((item) => item.notification_id));

  const filteredNotifications = userCreatedAt
    ? notifications.filter((item) => {
        const notificationDate = new Date(item.created_at).getTime();
        const userDate = new Date(userCreatedAt).getTime();

        if (!Number.isFinite(notificationDate) || !Number.isFinite(userDate)) {
          return true;
        }

        return notificationDate >= userDate;
      })
    : notifications;

  console.log("[notifications] getNotificationsWithReadStatus userCreatedAt:", userCreatedAt);
  console.log("[notifications] getNotificationsWithReadStatus notifications:", notifications);
  console.log("[notifications] getNotificationsWithReadStatus filteredNotifications:", filteredNotifications);
  console.log("[notifications] getNotificationsWithReadStatus reads:", reads);
  console.log("[notifications] getNotificationsWithReadStatus readIds:", Array.from(readIds));

  return filteredNotifications.map((item) => ({
    id: item.id,
    title: item.title,
    preview: item.preview,
    message: item.message,
    type: normalizeType(item.type),
    createdAt: item.created_at,
    isRead: readIds.has(item.id),
  }));
}