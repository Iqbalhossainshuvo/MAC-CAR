import { useState } from 'react';
import { Text } from 'react-native';

import { fileSize, pickFile, takePhoto, type PickedFile } from '@/lib/files';
import { isValidDate } from '@/lib/format';

import { Button, C, DateInput, F, Field, IconBtn, Input, Row, Select, Sheet, hexA, type Option } from './ui';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multiline' | 'email' | 'password' | 'phone' | 'file';

export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Show "None" option in selects */
  allowEmpty?: boolean;
}

type Values = Record<string, string>;

function toStrings(initial: Record<string, any>, fields: FieldDef[]): Values {
  const v: Values = {};
  for (const f of fields) {
    if (f.type === 'file') continue;
    const raw = initial[f.key];
    v[f.key] = raw === null || raw === undefined ? '' : String(raw);
  }
  return v;
}

/** Converts form strings to DB values: '' → null, numbers parsed. */
function toDb(values: Values, fields: FieldDef[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === 'file') continue;
    const v = values[f.key]?.trim() ?? '';
    if (f.type === 'number') out[f.key] = v === '' ? null : Number(v.replace(/,/g, ''));
    else if (f.type === 'password') out[f.key] = values[f.key] ?? '';
    else out[f.key] = v === '' ? null : v;
  }
  return out;
}

export function FormSheet({
  visible,
  title,
  fields,
  initial,
  onClose,
  onSubmit,
  saveText,
  footer,
}: {
  visible: boolean;
  title: string;
  fields: FieldDef[];
  initial: Record<string, any>;
  onClose: () => void;
  /** Return true to close the sheet. */
  onSubmit: (values: Record<string, any>) => Promise<boolean>;
  saveText?: string;
  footer?: string;
}) {
  const [values, setValues] = useState<Values>(() => toStrings(initial, fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, PickedFile | null>>({});
  const [saving, setSaving] = useState(false);


  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] ?? '').trim();
      if (f.required && v === '') e[f.key] = 'Required';
      else if (v !== '' && f.type === 'number' && Number.isNaN(Number(v.replace(/,/g, '')))) e[f.key] = 'Enter a number';
      else if (v !== '' && f.type === 'date' && !isValidDate(v)) e[f.key] = 'Use format YYYY-MM-DD';
      else if (v !== '' && f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) e[f.key] = 'Enter a valid email';
      else if (f.type === 'password' && f.required && v.length < 6) e[f.key] = 'At least 6 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = toDb(values, fields);
      for (const f of fields) if (f.type === 'file' && files[f.key]) data[f.key] = files[f.key];
      const ok = await onSubmit(data);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose} onSave={save} saving={saving} saveText={saveText}>
      {fields.map((f) => (
        <Field key={f.key} label={f.label + (f.required ? ' *' : '')} error={errors[f.key]}>
          {f.type === 'file' ? (
            <FilePickField value={files[f.key] ?? null} onChange={(v) => setFiles((prev) => ({ ...prev, [f.key]: v }))} />
          ) : f.type === 'select' ? (
            <Select
              value={values[f.key] ?? ''}
              options={f.options ?? []}
              onChange={(v) => set(f.key, v)}
              allowEmpty={f.allowEmpty}
              placeholder={f.placeholder}
            />
          ) : f.type === 'date' ? (
            <DateInput value={values[f.key] ?? ''} onChange={(v) => set(f.key, v)} />
          ) : (
            <Input
              value={values[f.key] ?? ''}
              onChangeText={(v) => set(f.key, v)}
              placeholder={f.placeholder}
              multiline={f.type === 'multiline'}
              secureTextEntry={f.type === 'password'}
              autoCapitalize={f.type === 'email' || f.type === 'password' || f.key === 'username' ? 'none' : 'sentences'}
              keyboardType={
                f.type === 'number'
                  ? 'decimal-pad'
                  : f.type === 'email'
                    ? 'email-address'
                    : f.type === 'phone'
                      ? 'phone-pad'
                      : 'default'
              }
            />
          )}
          {f.hint ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{f.hint}</Text> : null}
        </Field>
      ))}
      {footer ? <Text style={{ color: C.muted, fontSize: 12 }}>{footer}</Text> : null}
    </Sheet>
  );
}

export interface FormConfig {
  title: string;
  fields: FieldDef[];
  initial: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<boolean>;
  saveText?: string;
  footer?: string;
}

/** Holds one form sheet per screen: `form.open({...})` and render `form.element`. */
export function useFormSheet() {
  const [cfg, setCfg] = useState<FormConfig | null>(null);
  const [n, setN] = useState(0);
  const open = (c: FormConfig | null) => {
    if (c) setN((x) => x + 1); // fresh form state for every open
    setCfg(c);
  };
  const element = (
    <FormSheet
      key={n}
      visible={!!cfg}
      title={cfg?.title ?? ''}
      fields={cfg?.fields ?? []}
      initial={cfg?.initial ?? {}}
      onClose={() => setCfg(null)}
      onSubmit={cfg?.onSubmit ?? (async () => true)}
      saveText={cfg?.saveText}
      footer={cfg?.footer}
    />
  );
  return { open, close: () => setCfg(null), element };
}

/** Attach a file inside a form (e.g. an expense receipt). */
function FilePickField({ value, onChange }: { value: PickedFile | null; onChange: (v: PickedFile | null) => void }) {
  if (value) {
    return (
      <Row style={{ gap: 10, padding: 10, borderRadius: 14, backgroundColor: hexA(C.primary, 0.07) }}>
        <Text style={{ flex: 1, color: C.text, fontFamily: F.semi, fontSize: 13 }} numberOfLines={1}>
          {value.name} · {fileSize(value.size)}
        </Text>
        <IconBtn icon="close" color={C.muted} label="Remove attached file" onPress={() => onChange(null)} />
      </Row>
    );
  }
  return (
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>
      <Button small variant="ghost" icon="cloud-upload-outline" title="Choose file" onPress={async () => onChange(await pickFile())} />
      <Button small variant="ghost" icon="camera-outline" title="Take photo" onPress={async () => onChange(await takePhoto())} />
    </Row>
  );
}
