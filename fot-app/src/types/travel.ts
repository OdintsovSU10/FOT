export type TravelSegmentStatus = 'auto_approved' | 'delayed' | 'needs_object' | 'needs_route';

export interface ITravelConfig {
  limit_minutes: number | null;
}

export interface ITravelObject {
  id: string;
  name: string;
  is_active: boolean;
  access_points: string[];
  created_at: string;
  updated_at: string;
}

export interface ITravelRoute {
  id: string;
  from_object_id: string;
  from_object_name: string | null;
  to_object_id: string;
  to_object_name: string | null;
  travel_minutes: number;
  credit_multiplier: number;
  max_credit_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ITravelSegment {
  id: string;
  employee_id: number;
  employee_name: string;
  department_id: string | null;
  department_name: string | null;
  work_date: string;
  from_object_id: string | null;
  from_object_name: string | null;
  to_object_id: string | null;
  to_object_name: string | null;
  from_access_point_name: string | null;
  to_access_point_name: string | null;
  exit_time: string;
  entry_time: string;
  actual_minutes: number;
  norm_minutes: number | null;
  max_credit_minutes: number | null;
  credited_minutes: number;
  delay_minutes: number;
  status: TravelSegmentStatus;
  created_at: string;
  updated_at: string;
}
