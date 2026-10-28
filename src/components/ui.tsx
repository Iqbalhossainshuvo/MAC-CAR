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
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { expiryLevel, expiryText, fmtDate, isValidDate, today, type ExpiryLevel } from '@/lib/format';

// ---------------------------------------------------------------- design tokens
// Soft UI / glassmorphism: lavender background, white frosted cards,
// purple gradient accents, pastel round icons, generous radius.

export const C = {
  bg: '#F2F0FF',
  bg2: '#FFFFFF',
  panel: 'rgba(255, 255, 255, 0.82)',
  panelSolid: '#FFFFFF',
  field: '#F5F4FD',
  border: 'rgba(124, 92, 252, 0.12)',
  borderStrong: 'rgba(124, 92, 252, 0.35)',
  text: '#1E1B39',
  muted: '#6C6990',
  primary: '#7C5CFC',
  primary2: '#9B7BFF',
  primaryDeep: '#5B3FE0',
  onPrimary: '#FFFFFF',
  magenta: '#E0559F',
  violet: '#8B5CF6',
  blue: '#4F7BFF',
  green: '#12A150',
  red: '#E5484D',
  amber: '#D97706',
  gray: '#8A88A8',
};

/** Purple brand gradient (hero card, primary button, FAB) */
export const GRAD = ['#9B7BFF', '#7C5CFC', '#6A8BFF'] as const;

export const F = {
  display: 'PlusJakartaSans_800ExtraBold',
  displayBlack: 'PlusJakartaSans_800ExtraBold',
  bold: 'PlusJakartaSans_700Bold',
  semi: 'PlusJakartaSans_600SemiBold',
  mono: 'PlusJakartaSans_500Medium',
  monoMedium: 'PlusJakartaSans_600SemiBold',
  monoBold: 'PlusJakartaSans_700Bold',
  regular: 'PlusJakartaSans_400Regular',
};

/** Soft coloured drop shadow */
export const glow = (color: string, radius = 24, alpha = 0.18): ViewStyle =>
  ({ boxShadow: `0 ${Math.round(radius / 3)}px ${radius}px ${hexA(color, alpha)}` }) as ViewStyle;

/** Kept for compatibility — the soft theme does not glow text. */
export const textGlow = (_color?: string, _radius?: number): TextStyle => ({});

/** '#RRGGBB' + alpha → rgba() */
export function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

const isWeb = Platform.OS === 'web';
const pointer = isWeb ? ({ cursor: 'pointer' } as any) : null;
const blur = isWeb ? ({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any) : null;

// ---------------------------------------------------------------- background

/** The soft lavender gradient with glow blobs, drawn behind a screen. */
export function Backdrop() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: C.bg }]}>
      <LinearGradient colors={['#ECE8FF', '#F6F4FF', '#EEF3FF']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.blob, { top: -140, left: -120, backgroundColor: 'rgba(155,123,255,0.28)' }]} />
      <View style={[s.blob, { top: 260, right: -170, backgroundColor: 'rgba(106,139,255,0.20)' }]} />
      <View style={[s.blob, { bottom: -160, left: -60, backgroundColor: 'rgba(224,85,159,0.12)' }]} />
    </View>
  );
}

export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden', width: '100%', maxWidth: '100%' as any }}>
      <Backdrop />
      {children}
    </View>
  );
}

/**
 * Every screen paints its own solid background, so when you switch tabs or menu
 * items the previous screen never shows through.
 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      <Backdrop />
      {children}
    </View>
  );
}
/** @deprecated old name */
export const NeonBackground = AppBackground;

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
    <Page>
    <ScrollView
      style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={s.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} /> : undefined
      }
    >
      {children}
    </ScrollView>
    </Page>
  );
}

/** Frosted white card. `accent` tints the border only. */
export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  corners?: boolean;
}) {
  return <View style={[s.card, accent ? { borderColor: hexA(accent, 0.22) } : null, style]}>{children}</View>;
}

/** Purple gradient feature card (like "Today's goal"). */
export function HeroCard({ children, style, colors = GRAD }: { children: ReactNode; style?: StyleProp<ViewStyle>; colors?: readonly string[] }) {
  return (
    <View style={[s.hero, glow(C.primary, 34, 0.35), style]}>
      <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 26 }]} />
      <View pointerEvents="none" style={s.heroShine} />
      <View pointerEvents="none" style={s.heroRing} />
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
      <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/** Small section label above a card group */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 6, marginBottom: 10, paddingHorizontal: 2 }}>
      <Text style={{ color: C.text, fontFamily: F.bold, fontSize: 17 }}>{children}</Text>
      {right}
    </Row>
  );
}

export function T({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; mono?: boolean; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: C.text, fontSize: 14, fontFamily: F.regular }, style]}>
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
    <Page>
      <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={C.primary} size="large" />
        <Muted>{text}</Muted>
      </View>
    </Page>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card accent={C.red} style={{ backgroundColor: '#FFF5F5' }}>
      <Row>
        <IconTile icon="warning" color={C.red} size={34} />
        <Text style={{ color: C.red, fontFamily: F.bold, flex: 1 }}>Something went wrong</Text>
      </Row>
      <Text style={{ color: C.text, marginTop: 8, fontFamily: F.regular }}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="ghost" icon="refresh" onPress={onRetry} style={{ marginTop: 10 }} /> : null}
    </Card>
  );
}

export function Empty({ text, icon = 'sparkles-outline' }: { text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
      <View style={[s.emptyIcon]}>
        <Ionicons name={icon} size={24} color={C.primary} />
      </View>
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
    <View style={[s.badge, { backgroundColor: hexA(c, 0.11) }]}>
      <View style={[s.dot, { backgroundColor: c }]} />
      <Text style={[s.badgeText, { color: c }]}>{text.charAt(0).toUpperCase() + text.slice(1)}</Text>
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
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'magenta' | 'light';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const solidColor = variant === 'danger' ? C.red : variant === 'success' ? C.green : variant === 'magenta' ? C.magenta : null;
  const isGrad = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isLight = variant === 'light';
  const fg = isGhost ? C.primary : isLight ? C.primary : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed, hovered }: any) => [
        s.btn,
        small && s.btnSmall,
        isGrad ? glow(C.primary, hovered ? 26 : 18, 0.35) : null,
        solidColor ? [{ backgroundColor: solidColor }, glow(solidColor, 16, 0.3)] : null,
        isGhost ? { backgroundColor: hovered ? hexA(C.primary, 0.12) : hexA(C.primary, 0.08) } : null,
        isLight ? { backgroundColor: '#FFFFFF' } : null,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        isWeb ? ({ cursor: 'pointer', transition: 'all 160ms ease' } as any) : null,
        style,
      ]}
    >
      {isGrad ? (
        <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: small ? 12 : 16 }]} />
      ) : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
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
        { backgroundColor: pressed || hovered ? hexA(color, 0.16) : hexA(color, 0.09) },
        pointer,
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Round white button used in headers (search, bell, menu) */
export function RoundBtn({ icon, onPress, label, dot }: { icon: IconName; onPress?: () => void; label: string; dot?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.roundBtn, glow('#5B4BB7', 18, 0.12), { opacity: pressed ? 0.8 : 1 }, pointer]}>
      <Ionicons name={icon} size={20} color={C.text} />
      {dot ? <View style={s.roundDot} /> : null}
    </Pressable>
  );
}

export function Fab({ onPress, icon = 'add', label }: { onPress: () => void; icon?: IconName; label: string }) {
  const narrow = useWindowDimensions().width < 600;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.fab,
        narrow && { width: 58, height: 58, paddingHorizontal: 0, justifyContent: 'center', borderRadius: 29 },
        glow(C.primary, 30, 0.45),
        { opacity: pressed ? 0.9 : 1 },
        pointer,
      ]}
    >
      <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 29 }]} />
      <Ionicons name={icon} size={narrow ? 28 : 22} color="#fff" />
      {narrow ? null : <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 14 }}>{label}</Text>}
    </Pressable>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={[s.search, glow('#5B4BB7', 20, 0.08)]}>
      <Ionicons name="search" size={18} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        accessibilityLabel={placeholder}
        style={[{ flex: 1, paddingVertical: 12, color: C.text, fontSize: 15, fontFamily: F.regular }, noOutline]}
        autoCapitalize="none"
      />
      {value ? <IconBtn icon="close" color={C.muted} label="Clear search" onPress={() => onChange('')} /> : null}
    </View>
  );
}

/** Segmented pill control (Daily / Monthly / Yearly style) */
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginVertical: 4 }} contentContainerStyle={s.segment}>
      {options.map((o) => {
        const on = o === value;
        const label = labels?.[o] ?? o.charAt(0).toUpperCase() + o.slice(1);
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, on && [s.chipOn, glow(C.primary, 14, 0.3)], pointer]}
          >
            <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Circular progress ring (0–1) */
export function Ring({ value, size = 56, stroke = 6, color = C.primary, label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const id = `g${color.replace('#', '')}`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={label ?? `${Math.round(v * 100)}%`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.55" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={hexA(color, 0.14)} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontFamily: F.bold, fontSize: size > 50 ? 13 : 11, color: C.text }}>{label ?? `${Math.round(v * 100)}%`}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  sub,
  compact,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  sub?: string;
  /** three across on a phone */
  compact?: boolean;
}) {
  const c = TONE[tone];
  return (
    <View style={[s.stat, compact && s.statCompact, glow('#5B4BB7', 26, 0.1)]}>
      <View style={[s.statIcon, compact && { width: 34, height: 34, marginBottom: 10 }, { backgroundColor: hexA(c, 0.13) }]}>
        <Ionicons name={icon} size={compact ? 16 : 18} color={c} />
      </View>
      <Text style={[s.statValue, compact && { fontSize: 16 }, tone === 'red' ? { color: C.red } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={s.statSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={s.statGrid}>{children}</View>;
}

/** Rounded progress bar, value relative to max. */
export function Bar({ label, value, max, color = C.primary, right }: { label: string; value: number; max: number; color?: string; right: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / max) * 100)) : 0;
  const c = value < 0 ? C.red : color;
  return (
    <View style={{ marginVertical: 7 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, flex: 1, fontFamily: F.semi, fontSize: 13 }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: value < 0 ? C.red : C.text, fontFamily: F.bold, fontSize: 13 }}>{right}</Text>
      </Row>
      <View style={s.barTrack}>
        <LinearGradient colors={[hexA(c, 0.55), c]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: 8, borderRadius: 4 }} />
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
  const body = (
    <>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        {typeof subtitle === 'string' ? <Text style={s.itemSub}>{subtitle}</Text> : subtitle}
      </View>
      {right}
    </>
  );
  // Rows without a tap action are plain views, so buttons inside them stay clickable everywhere.
  if (!onPress) return <View style={s.item}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }: any) => [s.item, pressed || hovered ? { backgroundColor: hexA(C.primary, 0.05) } : null, pointer]}
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

/** Round pastel icon */
export function IconTile({ icon, color = C.primary, size = 44 }: { icon: IconName; color?: string; size?: number }) {
  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor: hexA(color, 0.13) }]}>
      <Ionicons name={icon} size={Math.round(size * 0.45)} color={color} />
    </View>
  );
}

/** Initials avatar with gradient */
export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, glow(C.primary, 20, 0.3)]}>
      <LinearGradient colors={['#B9A5FF', '#7C5CFC', '#6A8BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- inputs

const noOutline = isWeb ? ({ outlineStyle: 'none' } as any) : null;

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {error ? <Text style={{ color: C.red, marginTop: 4, fontSize: 12, fontFamily: F.semi }}>{error}</Text> : null}
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
        props.multiline && { minHeight: 96, textAlignVertical: 'top' },
        focus && [{ borderColor: C.primary, backgroundColor: '#FFFFFF' }, glow(C.primary, 16, 0.18)],
        noOutline,
        props.style,
      ]}
    />
  );
}

export function DateInput({ value, onChange, allowEmpty = true }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const bad = value !== '' && !isValidDate(value);
  if (isWeb) {
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
                borderRadius: 14,
                padding: '11px 14px',
                fontSize: 15,
                fontFamily: F.regular,
                colorScheme: 'light',
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
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[s.input, s.selectBox, pointer]}>
        <Text style={{ color: current ? C.text : C.muted, flex: 1, fontSize: 15, fontFamily: F.regular }} numberOfLines={1}>
          {current ? current.label : value === '' && allowEmpty ? emptyLabel : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={C.primary} />
      </Pressable>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.modalScrim}>
          <SafeAreaView style={s.modalPanel}>
            <Row style={{ padding: 14, gap: 10 }}>
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
                  right={item.value === value ? <Ionicons name="checkmark-circle" size={22} color={C.primary} /> : undefined}
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
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Card that holds a list of rows, with a heading. */
export function ListCard({ title, right, children, accent }: { title: string; right?: ReactNode; children: ReactNode; accent?: string }) {
  return (
    <Card style={{ paddingHorizontal: 0, paddingBottom: 6 }} accent={accent}>
      <View style={{ paddingHorizontal: 16 }}>
        <H2 right={right}>{title}</H2>
      </View>
      {children}
    </Card>
  );
}

/** Wraps into columns on wide screens, one column on phones. */
export function Columns({ children }: { children: ReactNode; min?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{children}</View>;
}

export function Col({ children, min = 340 }: { children: ReactNode; min?: number }) {
  return <View style={{ flexGrow: 1, flexBasis: min, minWidth: 0 }}>{children}</View>;
}

export const s = StyleSheet.create({
  blob: { position: 'absolute', width: 420, height: 420, borderRadius: 210, ...(isWeb ? ({ filter: 'blur(60px)' } as any) : { opacity: 0.6 }) },
  screen: { padding: 16, paddingBottom: 140, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  card: {
    backgroundColor: C.panel,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...glow('#5B4BB7', 30, 0.09),
    ...blur,
  },
  hero: { borderRadius: 26, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroShine: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroRing: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 26,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  h1: { fontSize: 26, fontFamily: F.display, color: C.text, letterSpacing: -0.4 },
  kicker: { color: C.muted, fontFamily: F.regular, fontSize: 14, marginTop: 4 },
  h2Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  h2: { fontSize: 16, fontFamily: F.bold, color: C.text },
  muted: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,92,252,0.07)',
  },
  kvLabel: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  kvValue: { color: C.text, fontSize: 14, fontFamily: F.semi, flexShrink: 1, textAlign: 'right' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontFamily: F.semi },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    minHeight: 50,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnSmall: { paddingHorizontal: 14, minHeight: 38, borderRadius: 12 },
  btnText: { fontFamily: F.bold, fontSize: 15 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, borderWidth: 2, borderColor: '#fff' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    borderRadius: 28,
    paddingHorizontal: 20,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    paddingLeft: 14,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  segment: {
    gap: 4,
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 14 },
  chipOn: { backgroundColor: C.primary },
  chipText: { color: C.muted, fontSize: 13, fontFamily: F.semi },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  stat: {
    flexGrow: 1,
    flexBasis: 130,
    minWidth: 0,
    backgroundColor: C.panel,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...blur,
  },
  statCompact: { flexBasis: 80, minWidth: 0, padding: 11, borderRadius: 20 },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statLabel: { color: C.muted, fontSize: 13, fontFamily: F.semi, marginTop: 2 },
  statValue: { fontSize: 22, fontFamily: F.display, color: C.text, letterSpacing: -0.3 },
  statSub: { color: C.muted, fontSize: 11, marginTop: 4, fontFamily: F.regular },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(124,92,252,0.09)', marginTop: 7 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,92,252,0.06)',
  },
  itemTitle: { fontSize: 15, fontFamily: F.bold, color: C.text },
  itemSub: { fontSize: 13, color: C.muted, marginTop: 3, fontFamily: F.regular },
  tile: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(124,92,252,0.1)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontFamily: F.semi, color: C.text, marginBottom: 7 },
  input: {
    backgroundColor: C.field,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 15,
    color: C.text,
    fontFamily: F.regular,
  },
  selectBox: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(30,27,57,0.35)', alignItems: 'center', justifyContent: 'center' },
  modalPanel: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#F7F6FF',
    ...(isWeb ? ({ borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border } as any) : null),
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#FFFFFF',
  },
});
