import type { FieldDef } from '@/components/FormSheet';
import type { Option } from '@/components/ui';

import { cap, carName, personName } from './format';
import { CAR_STATUSES, CATEGORY_LABEL, DOC_TYPES, EXPENSE_CATEGORIES, type Car, type Profile } from './types';

export const carOptions = (cars: Car[]): Option[] =>
  cars.map((c) => ({ value: c.id, label: carName(c), sub: cap(c.status) }));

export const driverOptions = (people: Profile[]): Option[] =>
  people
    .filter((p) => p.role === 'driver')
    .map((p) => ({ value: p.id, label: personName(p), sub: p.active ? p.phone ?? p.email ?? '' : 'Inactive' }));

const opts = (list: readonly string[], labels?: Record<string, string>): Option[] =>
  list.map((v) => ({ value: v, label: labels?.[v] ?? cap(v) }));

export const carFields: FieldDef[] = [
  { key: 'plate_no', label: 'Plate number', required: true, placeholder: 'e.g. ABC 1234' },
  { key: 'make', label: 'Make', placeholder: 'Toyota' },
  { key: 'model', label: 'Model', placeholder: 'Hiace' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'color', label: 'Color' },
  { key: 'vin', label: 'Chassis / VIN' },
  { key: 'status', label: 'Status', type: 'select', options: opts(CAR_STATUSES), required: true },
  { key: 'current_odometer', label: 'Current odometer (km)', type: 'number' },
  { key: 'purchase_date', label: 'Purchase date', type: 'date' },
  { key: 'purchase_price', label: 'Purchase price (SAR)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];

export const docFields: FieldDef[] = [
  { key: 'doc_type', label: 'Document type', type: 'select', options: opts(DOC_TYPES), required: true },
  { key: 'doc_number', label: 'Document / policy number' },
  { key: 'issue_date', label: 'Issue date', type: 'date' },
  { key: 'expiry_date', label: 'Expiry date', type: 'date', required: true },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];

export const assignFields = (cars: Car[], people: Profile[]): FieldDef[] => [
  { key: 'car_id', label: 'Car', type: 'select', options: carOptions(cars), required: true },
  { key: 'driver_id', label: 'Driver', type: 'select', options: driverOptions(people), required: true },
  { key: 'start_date', label: 'From date', type: 'date', required: true },
  { key: 'end_date', label: 'To date', type: 'date', hint: 'Leave empty if the driver is still driving this car.' },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];

export const incomeFields = (cars: Car[], people: Profile[]): FieldDef[] => [
  { key: 'car_id', label: 'Car', type: 'select', options: carOptions(cars), required: true },
  { key: 'customer_name', label: 'Given to (customer / company)', placeholder: 'Who rented the car' },
  { key: 'amount', label: 'Amount (SAR)', type: 'number', required: true },
  { key: 'income_date', label: 'Date received', type: 'date', required: true },
  { key: 'period_from', label: 'Rent period from', type: 'date' },
  { key: 'period_to', label: 'Rent period to', type: 'date' },
  {
    key: 'payment_status',
    label: 'Payment',
    type: 'select',
    options: [
      { value: 'paid', label: 'Paid' },
      { value: 'due', label: 'Due (not yet paid)' },
    ],
    required: true,
  },
  { key: 'driver_id', label: 'Driver (optional)', type: 'select', options: driverOptions(people), allowEmpty: true },
  { key: 'description', label: 'Description', type: 'multiline' },
];

const categoryOptions = opts(EXPENSE_CATEGORIES, CATEGORY_LABEL);

export const expenseFields = (cars: Car[], people: Profile[]): FieldDef[] => [
  { key: 'car_id', label: 'Car', type: 'select', options: carOptions(cars), required: true },
  { key: 'category', label: 'Category', type: 'select', options: categoryOptions, required: true },
  { key: 'amount', label: 'Amount (SAR)', type: 'number', required: true },
  { key: 'expense_date', label: 'Date', type: 'date', required: true },
  { key: 'driver_id', label: 'Driver', type: 'select', options: driverOptions(people), allowEmpty: true },
  {
    key: 'paid_by',
    label: 'Paid by',
    type: 'select',
    options: [
      { value: 'company', label: 'Company' },
      { value: 'driver', label: 'Driver (to reimburse)' },
    ],
    required: true,
  },
  { key: 'odometer', label: 'Odometer (km)', type: 'number' },
  { key: 'reference', label: 'Invoice / violation number' },
  { key: 'description', label: 'Details', type: 'multiline', placeholder: 'What was done / why the fine' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: opts(['approved', 'pending', 'rejected']),
    required: true,
  },
];

/** What a driver fills in */
export const driverExpenseFields = (cars: Car[]): FieldDef[] => [
  { key: 'car_id', label: 'Car', type: 'select', options: carOptions(cars), required: true },
  { key: 'category', label: 'Category', type: 'select', options: categoryOptions, required: true },
  { key: 'amount', label: 'Amount (SAR)', type: 'number', required: true },
  { key: 'expense_date', label: 'Date', type: 'date', required: true },
  {
    key: 'paid_by',
    label: 'Who paid?',
    type: 'select',
    options: [
      { value: 'driver', label: 'I paid (driver)' },
      { value: 'company', label: 'Company paid' },
    ],
    required: true,
  },
  { key: 'odometer', label: 'Odometer (km)', type: 'number' },
  { key: 'reference', label: 'Invoice / violation number' },
  { key: 'description', label: 'Details', type: 'multiline', placeholder: 'Workshop name, work done, fine reason…' },
];

export const logFields = (cars: Car[]): FieldDef[] => [
  { key: 'car_id', label: 'Car', type: 'select', options: carOptions(cars), required: true },
  { key: 'log_date', label: 'Date', type: 'date', required: true },
  { key: 'start_odometer', label: 'Start odometer (km)', type: 'number' },
  { key: 'end_odometer', label: 'End odometer (km)', type: 'number' },
  { key: 'trips', label: 'Number of trips', type: 'number' },
  { key: 'cash_collected', label: 'Cash collected (SAR)', type: 'number' },
  { key: 'work_details', label: 'Work done today', type: 'multiline', required: true },
];

export const profileFields: FieldDef[] = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'phone', label: 'Phone', type: 'phone' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'iqama_no', label: 'Iqama / ID number' },
  { key: 'iqama_expiry', label: 'Iqama expiry', type: 'date' },
  { key: 'license_no', label: 'Driving license number' },
  { key: 'license_expiry', label: 'License expiry', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];

export const newUserFields: FieldDef[] = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'username', label: 'Username (for login)', required: true, placeholder: 'e.g. karim', hint: 'Small letters, no spaces. The user signs in with this.' },
  { key: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 6 characters. Give it to the user.' },
  { key: 'email', label: 'Google email (optional)', type: 'email', hint: 'If set, this user can also use "Sign in with Google".' },
  { key: 'phone', label: 'Phone', type: 'phone' },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { value: 'driver', label: 'Driver' },
      { value: 'admin', label: 'Admin' },
    ],
    required: true,
  },
  { key: 'license_no', label: 'Driving license number' },
  { key: 'license_expiry', label: 'License expiry', type: 'date' },
  { key: 'iqama_no', label: 'Iqama / ID number' },
  { key: 'iqama_expiry', label: 'Iqama expiry', type: 'date' },
];

/** Admin editing an existing user */
export const editUserFields: FieldDef[] = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'username', label: 'Username (for login)', required: true },
  { key: 'email', label: 'Google email (optional)', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'phone' },
  {
    key: 'role',
    label: 'Role',
    type: 'select',
    options: [
      { value: 'driver', label: 'Driver' },
      { value: 'admin', label: 'Admin' },
    ],
    required: true,
  },
  { key: 'nationality', label: 'Nationality' },
  { key: 'iqama_no', label: 'Iqama / ID number' },
  { key: 'iqama_expiry', label: 'Iqama expiry', type: 'date' },
  { key: 'license_no', label: 'Driving license number' },
  { key: 'license_expiry', label: 'License expiry', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];
