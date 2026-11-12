/**
 * seed.js — İlk açılışta örnek veri üretir (uygulamanın tüm görünümlerini tanıtmak için).
 * Tarihler bugüne göre göreli hesaplanır.
 */
import { addDaysISO, todayISO } from './dateUtils.js';
import { createId } from './utils.js';

export function buildSeedEvents() {
  const t = todayISO();
  const d = (n) => addDaysISO(t, n);
  const id = { research: createId(), design: createId(), api: createId(), frontend: createId(), qa: createId(), launch: createId() };

  return [
    { id: id.research, title: 'Pazar araştırması', startDate: d(-6), endDate: d(-2), status: 'done', progress: 100, category: 'Proje', color: '#4f8cff', critical: true },
    { id: id.design, title: 'UI tasarımı', startDate: d(-1), endDate: d(4), status: 'doing', progress: 45, category: 'Proje', color: '#7c6cff', dependencies: [id.research], critical: true },
    { id: id.api, title: 'API entegrasyonu', startDate: d(1), endDate: d(6), status: 'todo', progress: 10, category: 'Proje', color: '#22c3a6', dependencies: [id.research] },
    { id: id.frontend, title: 'Frontend geliştirme', startDate: d(5), endDate: d(12), status: 'todo', category: 'Proje', color: '#ff8a4c', dependencies: [id.design] },
    { id: id.qa, title: 'Test & QA', startDate: d(13), endDate: d(16), status: 'todo', category: 'Proje', color: '#ff5d6c', dependencies: [id.frontend, id.api] },
    { id: id.launch, title: 'Lansman', startDate: d(17), endDate: d(17), status: 'todo', category: 'Proje', color: '#f5b84b', dependencies: [id.qa], critical: true },
    { title: 'Daily stand-up', description: 'Ekip senkronizasyonu', startDate: d(-14), startTime: '09:30', endTime: '09:45', recurrence: { freq: 'daily', interval: 1 }, category: 'Toplantı', color: '#3ecf8e', reminder: 5 },
    { title: 'Tasarım incelemesi', startDate: t, startTime: '11:00', endTime: '12:00', category: 'Toplantı', color: '#7c6cff', reminder: 15, status: 'doing' },
    { title: 'Müşteri görüşmesi', startDate: t, startTime: '11:30', endTime: '12:30', category: 'Toplantı', color: '#e45cc4' },
    { title: 'Öğle yemeği', startDate: t, startTime: '13:00', endTime: '14:00', category: 'Kişisel', color: '#f5b84b' },
    { title: 'Spor', startDate: d(1), startTime: '18:00', endTime: '19:00', recurrence: { freq: 'weekly', interval: 1 }, category: 'Kişisel', color: '#22c3a6' },
    { title: 'Haftalık rapor', startDate: d(2), startTime: '15:00', endTime: '16:00', category: 'İş', color: '#4f8cff', reminder: 60 },
    { title: 'Fatura ödemesi', startDate: d(-3), status: 'todo', category: 'Kişisel', color: '#ff5d6c' },
    { title: 'Konferans', startDate: d(8), endDate: d(9), category: 'İş', color: '#e45cc4', description: 'İki günlük ürün konferansı' },
  ];
}
