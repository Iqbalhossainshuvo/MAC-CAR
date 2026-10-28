import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expiryLevel, expiryText, fmtDate, isValidDate, today, type ExpiryLevel } from '@/lib/format';

// ---------------------------------------------------------------- design tokens
// HUD / sci-fi style: deep space background, neon cyan + magenta glow, glass panels.

export const C = {
  bg: '#05070F',
  bg2: '#0A1022',
  panel: 'rgba(13, 22, 42, 0.82)',
  panelSolid: '#0D162A',
  field: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(0, 229, 255, 0.22)',
  borderStrong: 'rgba(0, 229, 255, 0.55)',
  text: '#E6F1FF',
  muted: '#8FA3BF',
  primary: '#00E5FF',
  onPrimary: '#001218',
  magenta: '#FF2BD6',
  violet: '#8B5CF6',
  green: '#00FF9C',
  red: '#FF4D6D',
  amber: '#FFB020',
  gray: '#A3B1C6',
};

export const F = {
  display: 'Orbitron_700Bold',
  displayBlack: 'Orbitron_900Black',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

export const glow = (color: string, radius = 16, alpha = 0.45): ViewStyle =>
  ({ boxShadow: `0 0 ${radius}px ${hexA(color, alpha)}` }) as ViewStyle;

export const textGlow = (color: string, radius = 10): TextStyle => ({
  textShadowColor: hexA(color, 0.8),
  textShadowRadius: radius,
  textShadowOffset: { width: 0, height: 0 },
});

/** '#RRGGBB' + alpha → rgba() */
export function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- background

export function NeonBackground({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#0A1530', '#05070F', '#0B0618']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[s.orb, { top: -120, left: -80, backgroundColor: hexA(C.primary, 0.1) }]} />
      <View pointerEvents="none" style={[s.orb, { bottom: -140, right: -100, backgroundColor: hexA(C.magenta, 0.09) }]} />
      <View pointerEvents="none" style={s.grid} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={s.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Glass panel with neon edge and HUD corner marks. */
export function Card({
  children,
  style,
  accent = C.primary,
  corners = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  corners?: boolean;
}) {
  return (
    <View style={[s.card, { borderColor: hexA(accent, 0.25) }, style]}>
      {corners ? (
        <>
          <View pointerEvents="none" style={[s.corner, s.cTL, { borderColor: accent }]} />
          <View pointerEvents="none" style={[s.corner, s.cBR, { borderColor: accent }]} />
        </>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function H1({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.h1}>{children}</Text>
      {sub ? <Text style={s.kicker}>{sub}</Text> : null}
    </View>
  );
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.h2Row}>
      <Row style={{ flex: 1 }}>
        <View style={s.h2Tick} />
        <Text style={s.h2} numberOfLines={1}>
          {children}
        </Text>
      </Row>
      {right}
    </View>
  );
}

export function T({ children, style, mono, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; mono?: boolean; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: C.text, fontSize: 14, fontFamily: mono ? F.mono : undefined }, style]}>
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function KV({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[s.kvValue, color ? { color } : null]} selectable>
          {value === '' ? '-' : value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />;
}

// ---------------------------------------------------------------- feedback

export function Loading({ text = 'Syncing with Google Sheets…' }: { text?: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={C.primary} size="large" />
      <Muted>{text}</Muted>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card accent={C.red}>
      <Row>
        <Ionicons name="warning" size={18} color={C.red} />
        <Text style={{ color: C.red, fontFamily: F.monoBold }}>SYSTEM ERROR</Text>
      </Row>
      <Text style={{ color: C.text, marginTop: 6 }}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="ghost" icon="refresh" onPress={onRetry} style={{ marginTop: 10 }} /> : null}
    </Card>
  );
}

export function Empty({ text, icon = 'planet-outline' }: { text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', padding: 26, gap: 8 }}>
      <Ionicons name={icon} size={32} color={hexA(C.primary, 0.6)} />
      <Muted style={{ textAlign: 'center' }}>{text}</Muted>
    </View>
  );
}

export type Tone = 'green' | 'red' | 'amber' | 'gray' | 'blue' | 'magenta';

export const TONE: Record<Tone, string> = {
  green: C.green,
  red: C.red,
  amber: C.amber,
  gray: C.gray,
  blue: C.primary,
  magenta: C.magenta,
};

export function Badge({ text, tone = 'gray' }: { text: string; tone?: Tone }) {
  const c = TONE[tone];
  return (
    <View style={[s.badge, { borderColor: hexA(c, 0.5), backgroundColor: hexA(c, 0.1) }]}>
      <View style={[s.dot, { backgroundColor: c }, glow(c, 6, 0.9)]} />
      <Text style={[s.badgeText, { color: c }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

const LEVEL_TONE: Record<ExpiryLevel, Tone> = { expired: 'red', soon: 'amber', ok: 'green', none: 'gray' };

export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  return <Badge tone={LEVEL_TONE[expiryLevel(date)]} text={date ? `${fmtDate(date)} · ${expiryText(date)}` : 'No date'} />;
}

export function statusTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'green';
    case 'maintenance':
    case 'pending':
    case 'due':
      return 'amber';
    case 'rejected':
    case 'sold':
      return 'red';
    case 'admin':
      return 'magenta';
    case 'driver':
      return 'blue';
    default:
      return 'gray';
  }
}

// ---------------------------------------------------------------- controls

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'magenta';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const color =
    variant === 'danger' ? C.red : variant === 'success' ? C.green : variant === 'magenta' ? C.magenta : C.primary;
  const solid = variant !== 'ghost';
  const fg = solid ? C.onPrimary : color;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed, hovered }: any) => [
        s.btn,
        small && s.btnSmall,
        solid
          ? [{ backgroundColor: color }, glow(color, hovered || pressed ? 22 : 12, 0.55)]
          : { borderWidth: 1, borderColor: hexA(color, 0.6), backgroundColor: hexA(color, hovered ? 0.12 : 0.05) },
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 180ms ease' } as any) : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
          <Text style={[s.btnText, small && { fontSize: 12 }, { color: fg }]}>{title.toUpperCase()}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  onPress,
  color = C.primary,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        s.iconBtn,
        { borderColor: hexA(color, hovered ? 0.6 : 0.25), backgroundColor: hexA(color, pressed ? 0.2 : 0.06) },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'add', label }: { onPress: () => void; icon?: IconName; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.fab, glow(C.primary, 24, 0.6), { opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={C.onPrimary} />
      <Text style={{ color: C.onPrimary, fontFamily: F.monoBold, fontSize: 13 }}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={18} color={C.primary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        accessibilityLabel={placeholder}
        style={[{ flex: 1, paddingVertical: 11, color: C.text, fontSize: 15, fontFamily: F.mono }, noOutline]}
        autoCapitalize="none"
      />
      {value ? <IconBtn icon="close" color={C.muted} label="Clear search" onPress={() => onChange('')} /> : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && [s.chipOn, glow(C.primary, 10, 0.5)]]}
          >
            <Text style={[s.chipText, on && { color: C.onPrimary }]}>{(labels?.[o] ?? o).toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  sub,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  sub?: string;
}) {
  const c = TONE[tone];
  return (
    <View style={[s.stat, { borderColor: hexA(c, 0.3) }]}>
      <LinearGradient
        colors={[hexA(c, 0.16), 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={s.statLabel}>{label.toUpperCase()}</Text>
        <View style={[s.statIcon, { borderColor: hexA(c, 0.5) }, glow(c, 10, 0.35)]}>
          <Ionicons name={icon} size={16} color={c} />
        </View>
      </Row>
      <Text style={[s.statValue, { color: c }, textGlow(c, 12)]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={s.statGrid}>{children}</View>;
}

/** Neon horizontal bar, value relative to max. */
export function Bar({ label, value, max, color = C.primary, right }: { label: string; value: number; max: number; color?: string; right: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / max) * 100)) : 0;
  const c = value < 0 ? C.red : color;
  return (
    <View style={{ marginVertical: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, flex: 1, fontFamily: F.mono, fontSize: 13 }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: c, fontFamily: F.monoBold, fontSize: 13 }}>{right}</Text>
      </Row>
      <View style={s.barTrack}>
        <LinearGradient
          colors={[hexA(c, 0.5), c]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[{ width: `${pct}%`, height: 6, borderRadius: 3 }, glow(c, 8, 0.7)]}
        />
      </View>
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  left,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  left?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed, hovered }: any) => [
        s.item,
        (pressed || hovered) && onPress ? { backgroundColor: hexA(C.primary, 0.06) } : null,
        Platform.OS === 'web' && onPress ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        {typeof subtitle === 'string' ? <Text style={s.itemSub}>{subtitle}</Text> : subtitle}
      </View>
      {right}
    </Pressable>
  );
}

/** Square neon icon tile for list rows */
export function IconTile({ icon, color = C.primary }: { icon: IconName; color?: string }) {
  return (
    <View style={[s.tile, { borderColor: hexA(color, 0.45), backgroundColor: hexA(color, 0.08) }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
  );
}

// ---------------------------------------------------------------- inputs

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      {children}
      {error ? <Text style={{ color: C.red, marginTop: 4, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={hexA(C.muted, 0.7)}
      {...props}
      onFocus={(e) => {
        setFocus(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        props.onBlur?.(e);
      }}
      style={[
        s.input,
        props.multiline && { minHeight: 90, textAlignVertical: 'top' },
        focus && [{ borderColor: C.primary }, glow(C.primary, 12, 0.35)],
        noOutline,
        props.style,
      ]}
    />
  );
}

export function DateInput({ value, onChange, allowEmpty = true }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const bad = value !== '' && !isValidDate(value);
  if (Platform.OS === 'web') {
    // Native browser date picker on web
    return (
      <Row>
        <View style={{ flex: 1 }}>
          <input
            type="date"
            value={value}
            onChange={(e: any) => onChange(e.target.value)}
            style={
              {
                width: '100%',
                boxSizing: 'border-box',
                background: C.field,
                color: C.text,
                border: `1px solid ${bad ? C.red : C.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 15,
                fontFamily: F.mono,
                colorScheme: 'dark',
                outline: 'none',
              } as any
            }
          />
        </View>
        <Button small variant="ghost" title="Today" onPress={() => onChange(today())} />
      </Row>
    );
  }
  return (
    <Row>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={[{ flex: 1 }, bad && { borderColor: C.red }]}
      />
      <Button small variant="ghost" title="Today" onPress={() => onChange(today())} />
      {allowEmpty && value ? <IconBtn icon="close" color={C.muted} label="Clear date" onPress={() => onChange('')} /> : null}
    </Row>
  );
}

export interface Option {
  value: string;
  label: string;
  sub?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  allowEmpty,
  emptyLabel = 'None',
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(t)) : options;
    return allowEmpty ? [{ value: '', label: emptyLabel }, ...base] : base;
  }, [options, q, allowEmpty, emptyLabel]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[s.input, s.selectBox, Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null]}
      >
        <Text style={{ color: current ? C.text : C.muted, flex: 1, fontSize: 15 }} numberOfLines={1}>
          {current ? current.label : value === '' && allowEmpty ? emptyLabel : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={C.primary} />
      </Pressable>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.modalScrim}>
          <SafeAreaView style={s.modalPanel}>
            <Row style={{ padding: 12, gap: 10 }}>
              <IconBtn icon="arrow-back" label="Close" onPress={() => setOpen(false)} />
              <View style={{ flex: 1 }}>
                <SearchBar value={q} onChange={setQ} />
              </View>
            </Row>
            <FlatList
              data={list}
              keyExtractor={(o) => o.value || '__empty'}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <ListItem
                  title={item.label}
                  subtitle={item.sub}
                  right={item.value === value ? <Ionicons name="checkmark-circle" size={22} color={C.green} /> : undefined}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQ('');
                  }}
                />
              )}
              ListEmptyComponent={<Empty text="Nothing found" />}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

/** Form sheet with Save / Cancel. */
export function Sheet({
  visible,
  title,
  onClose,
  onSave,
  saving,
  saveText = 'Save',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveText?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.modalScrim}>
        <SafeAreaView style={s.modalPanel}>
          <View style={s.sheetHead}>
            <IconBtn icon="close" onPress={onClose} label="Close" />
            <Text style={[s.h2, { flex: 1, marginLeft: 10 }]} numberOfLines={1}>
              {title}
            </Text>
            {onSave ? <Button title={saveText} small icon="checkmark" onPress={onSave} loading={saving} /> : null}
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  orb: { position: 'absolute', width: 360, height: 360, borderRadius: 180 },
  grid: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.35,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(rgba(0,229,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.05) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        } as any)
      : null),
  },
  screen: { padding: 14, paddingBottom: 110, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  card: {
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)' } as any) : null),
  },
  corner: { position: 'absolute', width: 12, height: 12 },
  cTL: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 14 },
  cBR: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 14 },
  h1: { fontSize: 22, fontFamily: F.display, color: C.text, letterSpacing: 1.5, ...textGlow(C.primary, 14) },
  kicker: { color: C.primary, fontFamily: F.mono, fontSize: 12, letterSpacing: 2, marginTop: 4 },
  h2Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  h2Tick: { width: 4, height: 16, borderRadius: 2, backgroundColor: C.primary, ...glow(C.primary, 8, 0.8) },
  h2: { fontSize: 14, fontFamily: F.display, color: C.text, letterSpacing: 1.2 },
  muted: { color: C.muted, fontSize: 13 },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,229,255,0.07)',
  },
  kvLabel: { color: C.muted, fontSize: 13 },
  kvValue: { color: C.text, fontSize: 14, fontFamily: F.monoMedium, flexShrink: 1, textAlign: 'right' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: F.monoBold, letterSpacing: 0.6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 46,
    borderRadius: 10,
  },
  btnSmall: { paddingHorizontal: 12, minHeight: 36, borderRadius: 8 },
  btnText: { fontFamily: F.monoBold, fontSize: 14, letterSpacing: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.field,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.field,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 12, fontFamily: F.monoBold, letterSpacing: 0.8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statIcon: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: C.muted, fontSize: 11, fontFamily: F.monoBold, letterSpacing: 1, flex: 1 },
  statValue: { fontSize: 20, fontFamily: F.display, marginTop: 10 },
  statSub: { color: C.muted, fontSize: 11, marginTop: 4, fontFamily: F.mono },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 6, overflow: 'visible' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,229,255,0.08)',
  },
  itemTitle: { fontSize: 15, fontFamily: F.monoBold, color: C.text },
  itemSub: { fontSize: 13, color: C.muted, marginTop: 3 },
  tile: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: F.monoBold, color: C.primary, marginBottom: 6, letterSpacing: 1.2 },
  input: {
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    color: C.text,
    fontFamily: F.mono,
  },
  selectBox: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(2,4,10,0.75)', alignItems: 'center', justifyContent: 'center' },
  modalPanel: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    backgroundColor: C.bg2,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: C.border,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: 'rgba(0,229,255,0.04)',
  },
});

/** Card that holds a list of rows, with a heading. */
export function ListCard({
  title,
  right,
  children,
  accent,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <Card style={{ paddingHorizontal: 0, paddingBottom: 4 }} accent={accent}>
      <View style={{ paddingHorizontal: 14 }}>
        <H2 right={right}>{title}</H2>
      </View>
      {children}
    </Card>
  );
}

/** Two or three columns on wide screens, one on phones. */
export function Columns({ children, min = 340 }: { children: ReactNode; min?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
}

export function Col({ children, min = 340 }: { children: ReactNode; min?: number }) {
  return <View style={{ flexGrow: 1, flexBasis: min, minWidth: 0 }}>{children}</View>;
}
