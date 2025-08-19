// Types principaux pour BE FOR NOR KA
interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  category: string;
  status: 'pending' | 'validated' | 'rejected';
  membership_fee: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  registration_date: string;
  created_at: string;
  updated_at: string;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  is_active: boolean;
  is_current: boolean;
  registration_open: boolean;
  description?: string;
  max_members: number;
  membership_fees: Record<string, number>;
  required_documents: string[];
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  value: string;
  label: string;
  description: string;
  age_range: string;
  membership_fee: number;
  color: string;
  is_active: boolean;
  display_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string[];
  max_participants?: number;
  description?: string;
  coach: string;
  season_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface MemberDocument {
  id: string;
  member_id: string;
  document_type: 'ffvbForm' | 'medicalCertificate' | 'idPhoto' | 'parentalConsent';
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'validated' | 'rejected';
  rejection_reason?: string;
  validated_by?: string;
  validated_at?: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  is_active: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'webmaster' | 'administrateur' | 'tresorerie' | 'entraineur' | 'member';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  status: 'present' | 'absent' | 'pending' | 'late';
  response_date?: string;
  actual_presence?: 'present' | 'absent' | 'late';
  notes?: string;
  created_at: string;
  updated_at: string;
}