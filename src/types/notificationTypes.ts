export interface Notification {
  id: number;
  user_id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: Date;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
}

export interface CreateNotificationParams {
  userId: number;
  title: string;
  content: string;
  entityType?: string;
  entityId?: number;
}
