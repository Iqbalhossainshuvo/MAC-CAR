/** manager = admin assistant with the permissions the admin ticked */
export type Role = 'admin' | 'manager' | 'driver' | 'partner';

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
  /** salary structure (monthly_salary = sum of these) */
  basic_salary?: number | null;
  food_allowance?: number | null;
  housing_allowance?: number | null;
  transport_allowance?: number | null;
  other_allowance?: number | null;
  date_of_birth?: string | null;
  address?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  bank_name?: string | null;
  iban?: string | null;
  /** last time the user changed his own profile */
  profile_updated_at?: string | null;
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
  /** own = company car, rented = taken on rent from someone, shared = has partners */
  ownership?: Ownership | null;
  rent_owner?: string | null;
  rent_owner_phone?: string | null;
  /** rent the company pays the owner each month */
  monthly_rent?: number | null;
  rent_start?: string | null;
  rent_end?: string | null;
}

export type Ownership = 'own' | 'rented' | 'shared';

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
  | 'rent'
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
  /** company = paid directly by the company, driver = from his own pocket (paid back with salary), cash = from the company cash he holds */
  paid_by: 'company' | 'driver' | 'cash';
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

export type CashType = 'given' | 'returned' | 'to_salary' | 'from_salary';

/** Company money a driver holds for car work (CompanyCash sheet) */
export interface CashEntry extends Archivable {
  id: string;
  driver_id: string;
  type: CashType;
  amount: number;
  entry_date: string;
  method: 'cash' | 'bank' | 'other' | null;
  description: string | null;
  created_at: string;
}

/** A partner's share in a car (CarShares sheet) */
export interface CarShare extends Archivable {
  id: string;
  car_id: string;
  partner_id: string;
  partner_name?: string | null;
  share_percent: number;
  /** company management fee taken from the profit before sharing */
  fee_percent: number | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export type PartnerEntryType = 'payout' | 'adjust_add' | 'adjust_less';

/** Money paid to a partner, or a correction (PartnerWallet sheet) */
export interface PartnerEntry extends Archivable {
  id: string;
  partner_id: string;
  car_id: string | null;
  type: PartnerEntryType;
  amount: number;
  entry_date: string;
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
  'rent',
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
  'rent',
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
  rent: 'Car rent (to owner)',
  other: 'Other',
};
