/**
 * actions.js — Kullanıcı eylemleri (UI geri bildirimi + repository çağrıları).
 * Birden fazla bileşenin (editor, palette, sidebar, view'lar) paylaştığı iş akışları burada toplanır.
 */
import { eventRepo } from './eventRepo.js';
import { settingsRepo } from './settingsRepo.js';
import { store } from './state.js';
import { choiceDialog, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { exportJSON, importJSON, pickFile } from '../services/exportService.js';
import { notificationService } from '../services/notificationService.js';
import { userBackgroundRepo } from './userBackgroundRepo.js';
import { USER_PREFIX } from './backgrounds.js';

/** Onay alıp siler; "Geri al" ile etkinlik geri yüklenir (ekler hariç). */
export async function deleteEventWithUndo(id, { skipConfirm = false } = {}) {
  const ev = eventRepo.getById(id);
  if (!ev) return false;
  if (!skipConfirm) {
    const ok = await confirmDialog({
      title: 'Etkinlik silinsin mi?',
      message: ev.recurrence ? `"${ev.title}" tekrarlayan bir seri. Serinin tamamı silinecek.` : `"${ev.title}" kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return false;
  }
  const removed = await eventRepo.remove(id);
  toast(`"${ev.title}" silindi`, {
    type: 'warning',
    duration: 6000,
    action: { label: 'Geri al', onClick: () => eventRepo.mergeMany(removed) },
  });
  return true;
}

/**
 * Tekrarlayan bir örnek için kapsam sorar.
 * @param {'move'|'delete'} intent
 * @returns {Promise<'single'|'series'|null>}
 */
export function chooseRecurrenceScope(intent) {
  const isDelete = intent === 'delete';
  return choiceDialog({
    title: isDelete ? 'Tekrarlayan etkinliği sil' : 'Tekrarlayan etkinliği değiştir',
    message: isDelete ? 'Yalnızca bu etkinlik mi, yoksa serinin tamamı mı silinsin?' : 'Değişiklik yalnızca bu etkinliğe mi, yoksa serinin tamamına mı uygulansın?',
    choices: [
      { value: 'single', label: 'Yalnızca bu etkinlik', variant: isDelete ? 'btn-danger' : 'btn-primary' },
      { value: 'series', label: 'Tüm seri', variant: 'btn-ghost' },
    ],
  });
}

/** Sürükleme sırasında DOM'da yapılan görsel değişiklikleri geri almak için view'ı yeniden çizdirir. */
function refreshView() {
  store.set((s) => ({ events: [...s.events] }));
}

/** Görünümlerde sürükle-bırak/boyutlandırma sonucunu kaydeder. Tekrarlayan örneklerde kapsam sorulur. */
export async function moveOccurrence(occ, changes) {
  let scope = 'series';
  if (occ.isRecurring) {
    scope = await chooseRecurrenceScope('move');
    if (!scope) {
      refreshView();
      return;
    }
  }
  try {
    await eventRepo.applyOccurrenceChange(occ, changes, scope);
    if (occ.isRecurring) toast(scope === 'single' ? 'Yalnızca bu etkinlik güncellendi' : 'Serinin tamamı güncellendi', { type: 'success' });
  } catch (err) {
    toast(err.message, { type: 'error' });
    refreshView();
  }
}

/**
 * Bir örneği siler. Tekrarlamayan kayıtlarda normal silme yapılır; tekrarlayanlarda kapsam sorulur
 * (scope verilmişse sorulmaz). Tek örnek silme "Geri al" ile geri getirilebilir.
 * @returns {Promise<boolean>} silme yapıldı mı
 */
export async function deleteOccurrence(occ, scope) {
  if (!occ.isRecurring) return deleteEventWithUndo(occ.masterId || occ.id);
  const chosen = scope || (await chooseRecurrenceScope('delete'));
  if (!chosen) return false;
  if (chosen === 'series') return deleteEventWithUndo(occ.masterId, { skipConfirm: true });
  try {
    await eventRepo.excludeOccurrence(occ);
    toast(`"${occ.title}" bu tarih için silindi`, {
      type: 'warning',
      duration: 6000,
      action: { label: 'Geri al', onClick: () => eventRepo.includeOccurrence(occ.masterId, occ.startDate) },
    });
    return true;
  } catch (err) {
    toast(err.message, { type: 'error' });
    return false;
  }
}

export async function exportData() {
  try {
    const count = await exportJSON();
    toast(`${count} etkinlik dışa aktarıldı`, { type: 'success' });
  } catch (err) {
    toast(`Dışa aktarma başarısız: ${err.message}`, { type: 'error' });
  }
}

export async function importData() {
  const file = await pickFile();
  if (!file) return;
  const replace = await confirmDialog({
    title: 'İçe aktarma yöntemi',
    message: 'Mevcut etkinlikler silinip dosyadakilerle değiştirilsin mi? "Birleştir" seçilirse aynı kimlikli kayıtlar güncellenir, diğerleri korunur.',
    confirmText: 'Değiştir',
    cancelText: 'Birleştir',
    danger: true,
  });
  try {
    const count = await importJSON(file, { mode: replace ? 'replace' : 'merge' });
    toast(`${count} etkinlik içe aktarıldı`, { type: 'success' });
  } catch (err) {
    toast(err.message, { type: 'error', duration: 6000 });
  }
}

export const setTheme = (theme) => settingsRepo.set('theme', theme);
export const setBackground = (background) => settingsRepo.set('background', background);
export const setBackgroundFit = (fit) => settingsRepo.set('backgroundFit', fit);

/** Ay ve Hafta görünümünde çalışma dışı günleri göster / gizle. */
export const toggleShowOffDays = (force) => settingsRepo.set('showOffDays', force ?? store.get().settings.showOffDays === false);

/** Bir günü çalışma günü yapar / çalışma dışı bırakır (en az bir çalışma günü kalır). */
export function toggleWorkDay(day) {
  const current = new Set(store.get().settings.workDays ?? [1, 2, 3, 4, 5]);
  if (current.has(day)) {
    if (current.size === 1) {
      toast('En az bir çalışma günü seçili olmalı', { type: 'warning' });
      return undefined;
    }
    current.delete(day);
  } else current.add(day);
  return settingsRepo.set('workDays', [...current].sort((a, b) => a - b));
}

/** Kenar çubuğunu ikon moduna daraltır / genişletir (masaüstü). */
export const toggleSidebarCollapsed = () => settingsRepo.set('sidebarCollapsed', !store.get().settings.sidebarCollapsed);

/**
 * Kullanıcıdan bir görsel seçmesini ister, arka plan olarak kaydeder ve hemen uygular.
 * @returns {Promise<string|null>} eklenen arka planın değeri (user:<id>) veya vazgeçildiyse null
 */
export async function addUserBackground() {
  const file = await pickFile('image/*');
  if (!file) return null;
  try {
    const view = await userBackgroundRepo.add(file);
    const value = `${USER_PREFIX}${view.id}`;
    await setBackground(value);
    toast(`"${view.name}" arka plan olarak eklendi`, { type: 'success' });
    return value;
  } catch (err) {
    toast(err.message, { type: 'error', duration: 6000 });
    return null;
  }
}

/**
 * Kullanıcı görselini siler ("Geri al" ile geri getirilebilir). Seçili olan silinirse Standart'a döner.
 * @returns {Promise<string|null>} seçili arka plan değiştiyse yeni değer, değişmediyse null
 */
export async function removeUserBackground(id) {
  const value = `${USER_PREFIX}${id}`;
  const wasSelected = store.get().settings.background === value;
  const record = await userBackgroundRepo.remove(id);
  if (wasSelected) await setBackground('standard');
  toast(`"${record?.name ?? 'Görsel'}" silindi`, {
    type: 'warning',
    duration: 6000,
    action: {
      label: 'Geri al',
      onClick: async () => {
        await userBackgroundRepo.restore(record);
        if (wasSelected) await setBackground(value);
      },
    },
  });
  return wasSelected ? 'standard' : null;
}

export async function toggleNotifications(force) {
  const enabled = force ?? !store.get().settings.notificationsEnabled;
  if (!enabled) {
    await settingsRepo.set('notificationsEnabled', false);
    toast('Hatırlatmalar kapatıldı');
    return;
  }
  const permission = await notificationService.requestPermission();
  await settingsRepo.set('notificationsEnabled', true);
  if (permission === 'granted') toast('Hatırlatmalar açıldı', { type: 'success' });
  else toast('Tarayıcı bildirim izni yok; hatırlatmalar uygulama içinde gösterilecek', { type: 'warning', duration: 6000 });
  notificationService.check();
}
