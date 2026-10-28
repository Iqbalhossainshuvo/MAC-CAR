import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, isSynced } from '@/lib/data';
import {
  dataUri,
  downloadFile,
  fileSize,
  isImage,
  isPdf,
  loadRowFile,
  openNative,
  pickFile,
  removeRowFile,
  takePhoto,
  uploadRowFile,
  webPreviewUrl,
  type FileTable,
  type LoadedFile,
  type PickedFile,
} from '@/lib/files';
import type { WithFile } from '@/lib/types';

import { Button, C, F, IconBtn, Row, hexA } from './ui';

type Busy = null | 'view' | 'download' | 'remove';

/**
 * The file attached to a document or an expense (receipt):
 * upload, take a photo, view, download, replace, remove.
 */
export function FileBar({
  table,
  row,
  canUpload,
  canRemove,
  compact,
  label = 'file',
}: {
  table: FileTable;
  row: WithFile & { id: string };
  canUpload?: boolean;
  canRemove?: boolean;
  /** small chip for list rows */
  compact?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [viewer, setViewer] = useState<LoadedFile | null>(null);
  const uploading = row.file_id === 'pending';

  const upload = async (get: () => Promise<PickedFile | null>) => {
    const f = await get();
    if (f) uploadRowFile(table, row, f);
  };

  const view = async () => {
    setBusy('view');
    const f = await loadRowFile(table, row);
    setBusy(null);
    if (!f) return;
    if (Platform.OS !== 'web' && !isImage(f.mimeType)) await openNative(f);
    else setViewer(f);
  };

  const download = async () => {
    setBusy('download');
    const f = await loadRowFile(table, row);
    if (f) await downloadFile(f);
    setBusy(null);
  };

  const remove = async () => {
    if (!(await confirm(`Remove ${label}?`, `${row.file_name ?? 'The file'} is detached here but kept in your Google Drive.`, 'Remove'))) return;
    setBusy('remove');
    await removeRowFile(table, row);
    setBusy(null);
  };

  if (!row.file_id) {
    if (!canUpload) return compact ? null : <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>No {label} attached</Text>;
    if (compact) {
      return (
        <Row style={{ gap: 6, marginTop: 2 }}>
          <Button small variant="ghost" icon="attach" title={`Add ${label}`} onPress={() => upload(pickFile)} />
          <IconBtn icon="camera-outline" label={`Take photo of ${label}`} onPress={() => upload(takePhoto)} />
        </Row>
      );
    }
    return (
      <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        <Button small variant="ghost" icon="cloud-upload-outline" title="Upload file" onPress={() => upload(pickFile)} />
        <Button small variant="ghost" icon="camera-outline" title="Take photo" onPress={() => upload(takePhoto)} />
      </Row>
    );
  }

  const icon = isImage(row.file_type) ? 'image' : isPdf(row.file_type) ? 'document-text' : 'document';
  const chip = (
    <Pressable
      onPress={view}
      accessibilityRole="button"
      accessibilityLabel={`View ${row.file_name}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? 8 : 10,
          padding: compact ? 8 : 10,
          borderRadius: 14,
          backgroundColor: hexA(C.primary, pressed ? 0.12 : 0.07),
          alignSelf: compact ? 'flex-start' : 'stretch',
          maxWidth: '100%',
        },
      ]}
    >
      <Ionicons name={compact ? 'receipt-outline' : icon} size={compact ? 18 : 22} color={C.primary} />
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: C.text, fontFamily: F.semi, fontSize: compact ? 12 : 13 }} numberOfLines={1}>
          {compact ? `${label.charAt(0).toUpperCase() + label.slice(1)} · ` : ''}
          {row.file_name}
        </Text>
        {!compact ? (
          <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11 }}>
            {uploading ? 'Uploading…' : [row.file_type?.split('/')[1]?.toUpperCase(), fileSize(row.file_size)].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {busy === 'view' ? (
        <ActivityIndicator color={C.primary} />
      ) : uploading ? (
        <Ionicons name="cloud-upload-outline" size={18} color={C.amber} />
      ) : (
        <Ionicons name="eye-outline" size={18} color={C.primary} />
      )}
    </Pressable>
  );

  return (
    <View style={{ gap: 8, marginTop: 2 }}>
      {compact ? (
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {chip}
          <IconBtn icon="download-outline" label={`Download ${label}`} onPress={download} />
          {canUpload && !uploading ? <IconBtn icon="swap-horizontal" label={`Replace ${label}`} onPress={() => upload(pickFile)} /> : null}
          {canRemove && !uploading ? <IconBtn icon="close" color={C.muted} label={`Remove ${label}`} onPress={remove} /> : null}
        </Row>
      ) : (
        <>
          {chip}
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button small variant="ghost" icon="download-outline" title="Download" loading={busy === 'download'} onPress={download} />
            {canUpload && !uploading ? (
              <>
                <Button small variant="ghost" icon="swap-horizontal" title="Replace" onPress={() => upload(pickFile)} />
                <IconBtn icon="camera-outline" label="Replace with photo" onPress={() => upload(takePhoto)} />
              </>
            ) : null}
            {canRemove && !uploading ? <IconBtn icon="trash-outline" color={C.red} label="Remove file" onPress={remove} /> : null}
          </Row>
        </>
      )}
      <FileViewer file={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/** Document file bar (admin manages, others view). */
export function DocFileBar({ doc, manage }: { doc: WithFile & { id: string }; manage?: boolean }) {
  const synced = isSynced(doc.id);
  return <FileBar table="car_documents" row={doc} canUpload={manage} canRemove={manage && synced} />;
}

/** In-app preview: images everywhere, PDFs on web. */
export function FileViewer({ file, onClose }: { file: LoadedFile | null; onClose: () => void }) {
  const url = useMemo(() => (file && Platform.OS === 'web' && !isImage(file.mimeType) ? webPreviewUrl(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <Modal visible={!!file} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,18,40,0.92)' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <Row style={{ padding: 12, gap: 10 }}>
            <IconBtn icon="close" color="#fff" label="Close" onPress={onClose} />
            <Text style={{ color: '#fff', fontFamily: F.semi, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {file?.name}
            </Text>
            {file ? <IconBtn icon="download-outline" color="#fff" label="Download" onPress={() => downloadFile(file)} /> : null}
          </Row>
          <View style={{ flex: 1, padding: 12 }}>
            {file && isImage(file.mimeType) ? (
              <Image source={{ uri: dataUri(file) }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={file.name} />
            ) : file && Platform.OS === 'web' && url ? (
              <iframe src={url} title={file.name} style={{ flex: 1, width: '100%', height: '100%', border: 0, borderRadius: 12, background: '#fff' } as any} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Text style={{ color: '#fff', fontFamily: F.regular }}>This file cannot be previewed here.</Text>
                {file ? <Button title="Download" icon="download-outline" onPress={() => downloadFile(file)} /> : null}
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
