// Player-facing in-game patch notes — the data behind the "What's New" overlay.
//
// RULES:
//  - Newest version goes FIRST in this array.
//  - Each entry's `version` must be valid semver and match a bump in version.js
//    when it becomes the current build.
//  - This is the human-curated, player-friendly mirror of CHANGELOG.md
//    (CHANGELOG.md is the full dev history; this is the highlights players see).
//  - `tag` values map to colored chips in WhatsNew.js (TAG_CLASS). Unknown tags
//    fall back to a neutral chip, so you can invent new ones freely.
//
// Each item: { tag: 'Полёт', text: '...' }

export const UPDATES = [
  {
    version: '0.2.0',
    date: '2026-06-19',
    title: 'Боевая рубка',
    items: [
      { tag: 'Полёт', text: 'Глобальное сражение вокруг: капитальные корабли, рои истребителей, трассеры и далёкие взрывы — летишь сквозь битву.' },
      { tag: 'Новое', text: 'Управление переделано: виртуальный джойстик, слайдер тяги с бустом, кнопка FIRE.' },
      { tag: 'Графика', text: 'Видимые стволы в кадре — с откатом и дульной вспышкой на каждый выстрел.' },
      { tag: 'HUD', text: 'Боевой HUD: скорость, индикатор буста, маркеры захвата целей с дистанцией и лок-прицел.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-06-19',
    title: 'Первый рубеж',
    items: [
      { tag: 'Лор', text: 'Открыт фронт у Пояса Хелиос: Рой Сайленов вышел из Разлома над станцией «Терминус».' },
      { tag: 'Полёт', text: 'Рельсовая модель полёта: истребитель сам несётся вперёд, мир стримится на тебя.' },
      { tag: 'Графика', text: 'Набегающие частицы и варп-стрики — ощущение скорости без укачивания.' },
      { tag: 'AR', text: 'AR-lite: фон с камеры + наведение гироскопом. Космос вокруг тебя.' },
      { tag: 'ИИ', text: 'Волны Сайленов: разведчики-камикадзе, перехватчики, бомбардировщики и босс «Хор».' },
      { tag: 'Графика', text: 'Орудие с отдачей и вспышкой, трассеры, объёмные взрывы с ударной волной, вибрация.' },
      { tag: 'HUD', text: 'Прицел, щит/корпус, счёт с комбо-множителем, 360° радар угроз, рекорд.' },
      { tag: 'Звук', text: 'Реальные CC0-звуки (Kenney) и оркестровая музыка (FreePD) через Howler.js.' },
      { tag: 'Новое', text: 'Экран «Что нового»: при обновлении показываем только свежие изменения.' },
    ],
  },
];
