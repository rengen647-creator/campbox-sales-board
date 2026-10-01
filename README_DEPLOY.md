# CampBox Sales Board — GitHub Pages → Tilda

## Схема

GitHub Pages раздаёт `index.html` по HTTPS. Tilda содержит только T123-блок с iframe. Supabase отвечает за пользователей, роли и данные.

## 1. Настрой Supabase

1. Создай проект Supabase.
2. Выполни `supabase_setup.sql` в SQL Editor.
3. В `index.html` замени:
   - `PASTE_SUPABASE_URL` → Project URL;
   - `PASTE_SUPABASE_ANON_KEY` → publishable/anon key.
4. Никогда не вставляй `service_role` key в HTML/GitHub.
5. После регистрации своего аккаунта выполни в SQL Editor:

```sql
update public.profiles
set role='manager', active=true
where email='ТВОЯ_ПОЧТА';
```

## 2. GitHub Pages

Рекомендуемое имя отдельного репозитория: `campbox-sales-board`.

Загрузи в корень репозитория:

- `index.html`
- `supabase_setup.sql` (можно оставить только в приватной рабочей копии; для работы сайта не нужен)
- `.nojekyll`
- `robots.txt`

В GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.

Адрес обычно будет:

`https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/`

Важно: приложение защищено индивидуальной авторизацией Supabase/RLS. Сам экран входа при публичном GitHub Pages URL технически доступен по ссылке, но неактивный/неавторизованный пользователь данные не получает.

## 3. Настрой URL в Supabase

После появления GitHub Pages URL открой Supabase → Authentication → URL Configuration.

В Site URL укажи GitHub Pages адрес приложения. Если используешь email confirmation/reset password, добавь этот адрес в Redirect URLs.

## 4. Tilda

1. Создай отдельную страницу, например `/sales`.
2. Добавь **Другое → T123 «HTML-код»**.
3. Открой `tilda_T123_embed.txt`.
4. Замени `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/` на фактический GitHub Pages URL.
5. Вставь весь код в T123.
6. Опубликуй страницу.

Высота iframe меняется автоматически через `postMessage`, поэтому внутри Tilda не должно быть второго вертикального скролла.

## 5. Дополнительная защита Tilda

Индивидуальный вход внутри CampBox Sales Board остаётся основной защитой.

Дополнительно можно поставить общий пароль на Tilda-страницу: **Настройки страницы → Дополнительно → Пароль на страницу**. Это второй внешний слой, но не заменяет Supabase-роли.

Также включи запрет индексации страницы/сайта.

## 6. Обновления

После изменений достаточно заменить файлы в GitHub `main`. GitHub Pages обновит приложение; Tilda менять не нужно, потому что iframe URL остаётся тем же.

## Чек после деплоя

- [ ] GitHub Pages открывается по HTTPS.
- [ ] Вход работает.
- [ ] Неактивный аккаунт не видит доску.
- [ ] Сотрудник не переключает месяцы и не редактирует чужие строки.
- [ ] Руководитель переключает месяцы и редактирует всю доску.
- [ ] XLSX скачивается у руководителя.
- [ ] На Tilda нет вложенного вертикального скролла.
- [ ] На мобильном ширина 100%, таблицы прокручиваются внутри своих блоков.
