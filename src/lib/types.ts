/** manager = admin assistant with the permissions the admin ticked */
export type Role = 'admin' | 'manager' | 'driver';

/** "Deleted" rows are archived: hidden in the app, kept in the sheet, restorable. */
export interface Archivable {
  archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
}

/** A file stored in the admin's Google Drive (document scan, expense receipt). */
export interface WithFile {
  file_id?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

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
  /** driver's fixed monthly salary (SAR) */
  monthly_salary?: number | null;
  /** manager only, e.g. "cars:edit,expenses:view,approve" */
  permissions?: string | null;
}

export type CarStatus = 'active' | 'maintenance' | 'inactive' | 'sold';

export interface Car extends Archivable {
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

export interface CarDocument extends Archivable {
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

export interface Assignment extends Archivable {
  id: string;
  car_id: string;
  driver_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}

export interface Income extends Archivable {
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

export interface Expense extends Archivable, WithFile {
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
  /** fine forgiven by the admin: not taken from the driver's salary */
  waived?: boolean;
}

export type PayType = 'salary' | 'bonus' | 'advance' | 'deduction' | 'payment' | 'refund';

/** One line in a driver's salary account (Payroll sheet) */
export interface PayEntry extends Archivable {
  id: string;
  driver_id: string;
  type: PayType;
  amount: number;
  entry_date: string;
  /** YYYY-MM, for salary entries */
  month: string | null;
  method: 'cash' | 'bank' | 'other' | null;
  description: string | null;
  created_at: string;
}

export interface DailyLog extends Archivable {
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

/** Categories offered in new expense forms. Driver salaries are kept in the salary account instead. */
export const EXPENSE_INPUT_CATEGORIES: ExpenseCategory[] = [
  'fuel',
  'maintenance',
  'repair',
  'fine',
  'toll',
  'wash',
  'tyre',
  'insurance',
  'registration',
  'other',
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
