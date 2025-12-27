export interface Report {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;
  coords: { lat: number; lng: number };
  issue_type: string;
  image_url: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  estimated_resolution_time?: string;
  supervisor_id?: string;
  worker_name?: string;
  resolved_image_url?: string;
  resolved_class?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RequestUser {
  uid: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR';
  block_id: string | null;
}

export interface MLPrediction {
  predicted_class: string;
  confidence: number;
}

