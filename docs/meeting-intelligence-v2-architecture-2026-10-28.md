# CampBox Meeting Intelligence 2.0
Проектная архитектура и план реализации. 28.10.2026. Статус: проект, без изменений production.

## Цель
Автоматизировать полный цикл: загрузка записи или транскрибации -> распознавание -> разбор по единой методике «Продажника» -> подтверждение качества -> история и динамика навыков -> маркетинговые инсайты -> фактический результат в воронке и договоре.

## 1. Фактическая инфраструктура
- Яндекс Диск 500 ГБ — хранилище файлов, не база данных и не вычислительный ресурс.
- GitHub Sales Board: rengen647-creator/campbox-sales-board.
- Действующий Supabase Sales Board: kcjzrwmznahhischkrah, eu-central-1. Есть profiles, daily_sales, salary_contracts, salary_clients, csm_camps. Таблицы meeting_analyses и Edge Functions в production пока нет.
- PR #25 содержит UI-прототип и тестовую миграцию аналитики; не публиковать в текущем виде до правовой и интеграционной приемки.

## 2. Предпочтительная архитектура с границами данных (RU-first)
1. Яндекс Диск /CampBox/Meetings/00_INBOX: новые записи и транскрибации.
2. Yandex Cloud Functions Timer (Россия): опрос ограниченной папки Яндекс Диска по OAuth. Период — стартовое проектное значение 3–5 минут.
3. Инжест-сервис: проверка формата/готовности файла, hash, дедупликация, создание задания, журнал операций.
4. Yandex Message Queue: очередь, повторные попытки, DLQ; тяжёлые задачи выполняет RU worker (контейнер/VM).
5. SpeechKit async: аудио/видео -> текст с таймкодами; для длинных файлов — временный Yandex Object Storage в РФ. Яндекс Диск и Object Storage не одно и то же.
6. Модуль оценки: единая версия рубрики и JSON-schema; каждая оценка с подтверждающими цитатами/таймкодами; отсутствие данных не заменять нулями.
7. Российская база данных PostgreSQL для встреч, индивидуальных оценок, статусов, связи с клиентом, ошибок, маркетинговых сигналов и ревизий.
8. Результаты и транскрипты -> Яндекс Диск /01_PROCESSED, ошибки -> /02_NEEDS_REVIEW, отчёты -> /03_REPORTS, карантин -> /99_QUARANTINE.
9. Панель в Sales Board получает индивидуальные данные из авторизованного российского API, а не из EU Supabase. В существующий EU Supabase — только юридически допустимые обезличенные агрегаты после согласования.
10. Статус подписания подтверждается по salary_contracts/CSM, а не выводом нейросети.

## 3. Структура каталогов
/CampBox/Meetings/00_INBOX/
/CampBox/Meetings/01_PROCESSED/YYYY/MM/meeting_id/{recording,transcript.txt,transcript.json,analysis.json,assessment.md}/
/CampBox/Meetings/02_NEEDS_REVIEW/
/CampBox/Meetings/03_REPORTS/YYYY/MM/
/CampBox/Meetings/90_ARCHIVE/
/CampBox/Meetings/99_QUARANTINE/

## 4. Данные (мастер — РФ)
- meeting_sources: source_path, checksum, mime, length, ingested_at, job_state.
- meetings: meeting_id, owner_user_id, client_id?, deal_id?, date, meeting_type, confidence_match, status.
- meeting_transcripts: meeting_id, disk_path, timestamps, speaker_map, coverage, STT_version.
- meeting_assessments: meeting_id, revision, rubric_version, total_score, reliability, evidence, summary, approved_at.
- meeting_skills: assessment_id, skill_key, awarded, max_score, evidence_timestamps.
- meeting_findings: assessment_id, error_code, severity, growth_action, evidence.
- marketing_signals: meeting_id, topic_code, anonymized_signal, segment, suggested_use.
- meeting_events: meeting_id, deal_id, event, event_date, authoritative_source.
- coaching_actions: manager_id, target_skill, target_behavior, status, verified_at.
- pipeline_jobs / audit_log: state, retries, stage, error codes, immutable audit events.

## 5. Оценка качества и отчёт
- Фиксированная шкала 100: structure 10, diagnostics 15, pain_priority 20, decision_process 10, personalization 15, objections 10, next_step 15, communication 5.
- Рост = средняя оценка последних 3 сопоставимых встреч минус средняя предыдущих 3.
- Сопоставимые: один meeting_type и rubric_version, подтверждённая качество/полнота; иначе BASELINE.
- Повторяющиеся ошибки, слабые навыки, проверка выполнения коучинговой задачи на следующей встрече.
- Маркетинговые темы: частота по уникальным организациям и сегментам, разделение фактов клиента и гипотез ИИ.
- Продажи: результат по реальным событиям сделок; не путать корреляцию и причинность.
- По средам — сводка: динамика, 3 системные ошибки, 3 рекомендации, реальные переходы, 3 темы для маркетинга.

## 6. Правила надёжности
- Наличие загрузки в папке ещё не означает завершение файла: две стабильные проверки размера/даты либо явное подтверждение готовности.
- Идемпотентный source fingerprint; повторный импорт не создаёт дубликат встречи.
- Непонятный клиент/менеджер — на ручное подтверждение, не угадывать.
- Очередь имеет retries с exponential backoff и DLQ; материалы без подтверждённого результата не удалять.
- Ошибка STT/JSON/schema -> ручная проверка, причины ошибки сохраняются.
- Итоговая оценка хранит ревизии; исходная оценка не переписывается без журнала.
- Доступ: менеджер — свои встречи; руководитель — команда; маркетинг — утверждённые обезличенные сигналы; оператор — очередь.
- Не передавать токен Яндекса в браузер, GitHub, отчёты или чат. OAuth через защищённый сервер; роли, аудит, ротация и отзыв.
- Яндекс Диск не заменяет резервную копию: отдельный backup базы и резерв/версии файлов, тест восстановления.

## 7. Этапы и критерии приёмки
Этап 0 / безопасность: карта данных RU/EU, правовые основания записи, согласования 152-ФЗ, роли, политика сроков. Gate: юрист/ИБ согласовали поток данных.
Этап 1 / Диск: OAuth и каталоги, upload/download и отзыв токена. Gate: ограниченный доступ к нужной папке.
Этап 2 / обнаружение: timer, дедуп, очередь, DLQ. Gate: 20 тестовых файлов -> 20 задач, 0 дублей, 0 потерь.
Этап 3 / распознавание: SpeechKit + временный Object Storage. Gate: длинная запись, таймкоды, спикеры, восстановление ошибок.
Этап 4 / оценка: JSON-schema, версия рубрики, evidence. Gate: 10–20 встреч сопоставлены с экспертными разборами.
Этап 5 / хранилище: RU PostgreSQL, auth/API, аудит. Gate: проверка ролей и отрицательных RLS-сценариев.
Этап 6 / Sales Board: тренд и история, фокус коучинга, маркетинг. Gate: фильтры и корректность baseline / 3+3 / мобильный UX.
Этап 7 / связь с воронкой: надежные ID из salary_contracts/client, подписания. Gate: отсутствие двойного учёта.
Этап 8 / история: импорт старых разборов, происхождение. Gate: недостоверные ручные оценки не смешиваются с надёжными.
Этап 9 / эксплуатация: мониторинг очередей, расходы, оповещения, weekly review. Gate: восстановление после сбоя и тест регулярного отчёта.

## 8. Необходимые решения
1. Личный или корпоративный Яндекс 360 Диск? Для команды предпочтителен корпоративный отдельный аккаунт.
2. Формат исходников: аудио, видео или готовые транскрибации? Где сейчас появляется запись?
3. Есть ли платный Yandex Cloud? SpeechKit/AI Studio не включены в 500 ГБ Диска.
4. Кто юридический оператор записи и ПДн? Можно ли передавать текст сторонней модели? Базовый ответ до правового решения — нет.
5. Какой идентификатор сделки/лагеря уже известен при создании файла?
6. Кто утверждает маркетинговые инсайты и срок хранения оригинала?

## 9. Риски существующего PR #25
- В текущем PR JSON-импорт идёт из браузера и хранит записи в EU Supabase; это не целевая архитектура для персональных данных.
- Запретить клиенту свободно назначать manager_id/created_by и переписывать оценки без неизменяемых ревизий.
- Человекочитаемый «Продажник» нельзя считать непосредственно API: нужен отдельный серверный pipeline с эквивалентной методикой, версиями, тестами и provenance.
- Выполнить новую полную интеграционную QA до слияния и публикации.

## 10. Официальные источники
- https://yandex.ru/dev/disk/rest/
- https://yandex.ru/dev/id/doc/ru/access
- https://yandex.cloud/ru/docs/functions/operations/trigger/timer-create
- https://yandex.cloud/ru/services/message-queue
- https://yandex.cloud/ru/docs/storage/tutorials/batch-recognition-stt
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/queues
- https://www.consultant.ru/document/Cons_doc_LAW_61801/cbf4e15b7c330f9372e876cdf2bc928bad7950ef/