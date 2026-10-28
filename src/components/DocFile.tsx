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
  loadDocFile,
  openNative,
  pickFile,
  removeDocFile,
  takePhoto,
  uploadDocFile,
  webPreviewUrl,
  type LoadedFile,
  type PickedFile,
} from '@/lib/files';
import type { CarDocument } from '@/lib/types';

import { Button, C, F, IconBtn, Row, hexA } from './ui';

type Busy = null | 'upload' | 'view' | 'download' | 'remove';

/** File attached to a document: upload, take photo, view, download, replace, remove. */
export function DocFileBar({ doc, manage }: { doc: CarDocument; manage?: boolean }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [viewer, setViewer] = useState<LoadedFile | null>(null);
  const synced = isSynced(doc.id);

  const upload = async (get: () => Promise<PickedFile | null>) => {
    const f = await get();
    if (!f) return;
    setBusy('upload');
    await uploadDocFile(doc, f);
    setBusy(null);
  };

  const view = async () => {
    setBusy('view');
    const f = await loadDocFile(doc);
    setBusy(null);
    if (!f) return;
    if (Platform.OS !== 'web' && !isImage(f.mimeType)) await openNative(f);
    else setViewer(f);
  };

  const download = async () => {
    setBusy('download');
    const f = await loadDocFile(doc);
    if (f) await downloadFile(f);
    setBusy(null);
  };

  const remove = async () => {
    if (!(await confirm('Remove file?', `${doc.file_name ?? 'The file'} will be moved to the trash in Google Drive.`, 'Remove'))) return;
    setBusy('remove');
    await removeDocFile(doc);
    setBusy(null);
  };

  if (!doc.file_id) {
    if (!manage) return <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>No file attached</Text>;
    if (!synced) return <Text style={{ color: C.muted, fontSize: 12, fontFamily: F.regular }}>Saving… you can attach a file in a moment</Text>;
    return (
      <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        <Button small variant="ghost" icon="cloud-upload-outline" title="Upload file" loading={busy === 'upload'} onPress={() => upload(pickFile)} />
        <Button small variant="ghost" icon="camera-outline" title="Take photo" disabled={busy === 'upload'} onPress={() => upload(takePhoto)} />
      </Row>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 2 }}>
      <Pressable
        onPress={view}
        accessibilityRole="button"
        accessibilityLabel={`View ${doc.file_name}`}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 14,
            backgroundColor: hexA(C.primary, pressed ? 0.12 : 0.07),
            alignSelf: 'stretch',
          },
        ]}
      >
        <Ionicons name={isImage(doc.file_type) ? 'image' : isPdf(doc.file_type) ? 'document-text' : 'document'} size={22} color={C.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontFamily: F.semi, fontSize: 13 }} numberOfLines={1}>
            {doc.file_name}
          </Text>
          <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11 }}>{[doc.file_type?.split('/')[1]?.toUpperCase(), fileSize(doc.file_size)].filter(Boolean).join(' · ')}</Text>
        </View>
        {busy === 'view' ? <ActivityIndicator color={C.primary} /> : <Ionicons name="eye-outline" size={20} color={C.primary} />}
      </Pressable>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button small variant="ghost" icon="download-outline" title="Download" loading={busy === 'download'} onPress={download} />
        {manage ? (
          <>
            <Button small variant="ghost" icon="swap-horizontal" title="Replace" loading={busy === 'upload'} onPress={() => upload(pickFile)} />
            <IconBtn icon="camera-outline" label="Replace with photo" onPress={() => upload(takePhoto)} />
            <IconBtn icon="trash-outline" color={C.red} label="Remove file" onPress={remove} />
          </>
        ) : null}
      </Row>
      <FileViewer file={viewer} onClose={() => setViewer(null)} />
    </View>
  );
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
