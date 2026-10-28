import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { api } from './api';
import { notify, pendingFileFor, putLocal, queueUpload, realId } from './data';
import type { WithFile } from './types';

export type FileTable = 'car_documents' | 'expenses';
type FileRow = WithFile & { id: string };

export const MAX_FILE_MB = 10;

export interface PickedFile {
  name: string;
  mimeType: string;
  base64: string;
  size: number;
}

export interface LoadedFile {
  name: string;
  mimeType: string;
  base64: string;
}

const isWeb = Platform.OS === 'web';

function fromDataUrl(s: string) {
  return s.replace(/^data:[^,]*,/, '');
}

function readWebFile(f: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(fromDataUrl(String(r.result)));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(f);
  });
}

function tooBig(size: number) {
  if (size > MAX_FILE_MB * 1024 * 1024) {
    notify('File too big', `Please choose a file under ${MAX_FILE_MB} MB.`);
    return true;
  }
  return false;
}

/** Choose a PDF or image from the phone / computer. */
export async function pickFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const size = a.size ?? a.file?.size ?? 0;
  if (tooBig(size)) return null;
  const base64 = isWeb && a.file ? await readWebFile(a.file) : await new File(a.uri).base64();
  return { name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', base64, size: size || Math.round((base64.length * 3) / 4) };
}

/** Take a photo of a paper document with the camera. */
export async function takePhoto(): Promise<PickedFile | null> {
  if (!isWeb) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      notify('Camera not allowed', 'Allow camera access for MAC CAR in your phone settings.');
      return null;
    }
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  const a = res.assets[0];
  const base64 = a.base64!;
  const size = Math.round((base64.length * 3) / 4);
  if (tooBig(size)) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  return { name: a.fileName ?? `photo-${stamp}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', base64, size };
}

/** Upload (or replace) the file of a document or expense. Queued: works offline and for new rows. */
export function uploadRowFile(table: FileTable, row: FileRow, f: PickedFile) {
  queueUpload(table, row.id, f);
  return true;
}

export async function removeRowFile(table: FileTable, row: FileRow): Promise<boolean> {
  try {
    const saved = await api<FileRow>('removeFile', { table, id: realId(row.id) });
    putLocal(table, saved);
    return true;
  } catch (e: any) {
    notify('Could not remove the file', e?.message);
    return false;
  }
}

// Files already opened in this session, so viewing again is instant
const memo = new Map<string, LoadedFile>();

export async function loadRowFile(table: FileTable, row: FileRow): Promise<LoadedFile | null> {
  const waiting = pendingFileFor(table, row.id);
  if (waiting) return { name: waiting.name, mimeType: waiting.mimeType, base64: waiting.base64 };
  const key = `${table}:${row.id}:${row.file_id}`;
  if (memo.has(key)) return memo.get(key)!;
  try {
    const f = await api<LoadedFile>('getFile', { table, id: realId(row.id) });
    memo.set(key, f);
    return f;
  } catch (e: any) {
    notify('Could not open the file', e?.message);
    return null;
  }
}

export const isImage = (mime?: string | null) => !!mime && mime.startsWith('image/');
export const isPdf = (mime?: string | null) => mime === 'application/pdf';

export function dataUri(f: LoadedFile) {
  return `data:${f.mimeType};base64,${f.base64}`;
}

function webBlobUrl(f: LoadedFile) {
  const bin = atob(f.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: f.mimeType }));
}

/** Blob URL to show a PDF inside the app on web */
export function webPreviewUrl(f: LoadedFile) {
  return webBlobUrl(f);
}

async function nativeFile(f: LoadedFile) {
  const file = new File(Paths.cache, f.name.replace(/[\\/:*?"<>|]+/g, '_'));
  try {
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
  await file.write(f.base64, { encoding: 'base64' });
  return file;
}

/** Open with the phone's viewer (PDF etc.). */
export async function openNative(f: LoadedFile) {
  const file = await nativeFile(f);
  try {
    await file.preview({ title: f.name, mimeType: f.mimeType });
  } catch {
    await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, dialogTitle: f.name });
  }
}

/** Save a copy: browser download on web, share / "Save to Files" on phones. */
export async function downloadFile(f: LoadedFile) {
  if (isWeb) {
    const url = webBlobUrl(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const file = await nativeFile(f);
  await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, dialogTitle: f.name });
}

export function fileSize(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
