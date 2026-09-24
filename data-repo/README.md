# Шаблон для приватного репо с данными

Эти файлы приложение само кладёт в ваш `you-me-data` (Настройки → Уведомления → «Настроить уведомления»), если у токена есть право **Workflows: Read and write**.

Если право не дали — скопируй руками, сохранив пути:

```
.github/workflows/you-me-notify.yml
.github/you-me/notify.mjs
```

Потом в приложении всё равно нажми «Настроить уведомления» — оно создаст ключи VAPID в `data/config.json`.

Ручной запуск для проверки: репо данных → **Actions → You&Me notify → Run workflow** (`morning` или `evening`).

Структура данных в репо:

```
data/config.json        имена, цвета, часовой пояс, ключи пушей, адрес Worker
data/events.json        события календаря
data/people.json        люди и дни рождения
data/wishes.json        хотелки
data/reservations.json  тайные брони подарков
data/plans.json         планы
data/expenses.json      траты и «отложили»
data/cards.json         карты лояльности
data/shopping.json      покупки
data/answers.json       ответы на вопрос дня
data/tasks.json         задачи
data/capsules.json      капсулы времени (письма в будущее)
data/reads.json         кто какое письмо прочитал
data/votes.json         тайные голосования
data/ballots.json       голоса (у каждого своя запись)
data/devices.json       подписки на пуши (по телефону)
img/YYYY-MM/*.jpg       фото хотелок и капсул
```

Формат: `{"v": 1, "items": {"<id>": {...}}}`, по строке на запись — диффы на GitHub читаются глазами.
