export type Role = 'admin' | 'driver';

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: Role;
  active: boolean;
  nationality: string | null;
  iqama_no: string | null;
  iqama_expiry: string | null;
  license_no: string | null;
  license_expiry: string | null;
  notes: string | null;
  created_at: string;
  has_password?: boolean;
}

export type CarStatus = 'active' | 'maintenance' | 'inactive' | 'sold';

export interface Car {
  id: string;
  plate_no: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  status: CarStatus;
  purchase_date: string | null;
  purchase_price: number | null;
  current_odometer: number | null;
  notes: string | null;
  created_at: string;
}

export interface CarDocument {
  id: string;
  /** a document belongs to a car OR to a driver */
  car_id: string | null;
  driver_id?: string | null;
  doc_type: string;
  doc_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  /** attached file in the admin's Google Drive */
  file_id?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export interface Assignment {
  id: string;
  car_id: string;
  driver_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}

export interface Income {
  id: string;
  car_id: string;
  driver_id: string | null;
  customer_name: string | null;
  amount: number;
  income_date: string;
  period_from: string | null;
  period_to: string | null;
  payment_status: 'paid' | 'due';
  description: string | null;
}

export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'repair'
  | 'fine'
  | 'toll'
  | 'wash'
  | 'tyre'
  | 'insurance'
  | 'registration'
  | 'salary'
  | 'other';

export interface Expense {
  id: string;
  car_id: string;
  driver_id: string | null;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  description: string | null;
  reference: string | null;
  odometer: number | null;
  paid_by: 'company' | 'driver';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface DailyLog {
  id: string;
  driver_id: string;
  car_id: string;
  log_date: string;
  start_odometer: number | null;
  end_odometer: number | null;
  trips: number | null;
  cash_collected: number | null;
  work_details: string | null;
  created_at: string;
}

export const CAR_STATUSES: CarStatus[] = ['active', 'maintenance', 'inactive', 'sold'];

export const DRIVER_DOC_TYPES = ['Iqama', 'Driving License', 'Passport', 'Contract', 'Medical', 'Other'];

export const DOC_TYPES = [
  'Istimara',
  'Insurance',
  'Fahas',
  'Operating Card',
  'Tamm Authorization',
  'Other',
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'fuel',
  'maintenance',
  'repair',
  'fine',
  'toll',
  'wash',
  'tyre',
  'insurance',
  'registration',
  'salary',
  'other',
];

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  repair: 'Repair',
  fine: 'Fine / Violation',
  toll: 'Toll / Parking',
  wash: 'Car Wash',
  tyre: 'Tyre',
  insurance: 'Insurance',
  registration: 'Registration / Fahas',
  salary: 'Driver Salary',
  other: 'Other',
};
