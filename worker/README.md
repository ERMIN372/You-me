# Worker для «Хотелок по ссылке»

Маленький бесплатный [Cloudflare Worker](https://developers.cloudflare.com/workers/) (серверная функция на серверах Cloudflare). По ссылке на товар отдаёт название, цену и картинку (из Open Graph и schema.org — стандартных метаданных страниц), а также проксирует картинку, чтобы приложение сжало её и сохранило в ваш приватный репо.

Бесплатный план Cloudflare — 100 000 запросов в день, вам хватит с огромным запасом.

## Вариант А: через сайт (без командной строки)

1. Зарегистрируйся на [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Create Worker** → имя `you-me-preview` → **Deploy**.
3. **Edit code** → удали всё → вставь содержимое [`src/index.js`](src/index.js) → **Deploy**.
4. Worker → **Settings → Variables and Secrets**:
   - `KEY` — тип **Secret**, значение — длинная случайная строка (например, сгенерируй пароль на 32 символа);
   - `ORIGIN` — тип **Text**, значение `https://ermin372.github.io`.
5. Скопируй адрес вида `https://you-me-preview.<имя>.workers.dev`.
6. В приложении: **Настройки → Хотелки по ссылке** → адрес и тот же `KEY`.

## Вариант Б: через wrangler (CLI Cloudflare)

```bash
cd worker
npx wrangler login
npx wrangler deploy
npx wrangler secret put KEY
```

## Проверка

```bash
curl -H "X-Key: <KEY>" "https://you-me-preview.<имя>.workers.dev/preview?url=https://example.com"
```

Должен вернуться JSON вида `{"title":"Example Domain"}`. Без ключа — `403 forbidden`.

## Ограничения

- Wildberries и Ozon часто отвечают ботам капчей или отдают страницу без данных. Для WB Worker пробует их публичное API карточки — оно недокументировано и может перестать работать в любой момент. Если ничего не подтянулось — заполни хотелку вручную.
- Ключ `KEY` хранится в приватном репо данных (`data/config.json`), поэтому без токена его не узнать.
