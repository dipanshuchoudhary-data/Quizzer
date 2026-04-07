import { api } from "@/lib/api/client"

export type NotificationCategory = "update" | "announcement" | "alert"

export interface InboxNotification {
  id: string
  title: string
  description: string
  category: NotificationCategory
  created_at: string
  read: boolean
}

export interface NotificationListResponse {
  items: InboxNotification[]
  unread_count: number
}

export const notificationsApi = {
  async list(): Promise<NotificationListResponse> {
    const { data } = await api.get<NotificationListResponse>("/notifications")
    return data
  },

  async unreadCount(): Promise<{ unread_count: number }> {
    const { data } = await api.get<{ unread_count: number }>("/notifications/unread-count")
    return data
  },

  async markAllRead(): Promise<{ success: boolean }> {
    const { data } = await api.post<{ success: boolean }>("/notifications/read-all")
    return data
  },

  async broadcast(payload: {
    title: string
    description: string
    category: NotificationCategory
  }): Promise<InboxNotification> {
    const { data } = await api.post<InboxNotification>("/notifications/broadcast", payload)
    return data
  },
}
