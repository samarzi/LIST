# Деплой проекта LIST на Render

## Структура репозитория

```
LIST/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   ├── render.yaml
│   └── ...
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── render.yaml
│   └── ...
├── docker-compose.yml
└── DEPLOYMENT.md
```

## Что нужно от вас

1. **GitHub репозиторий** - создайте и загрузите весь проект
2. **Аккаунт на Render** - зарегистрируйтесь на render.com
3. **DATABASE_URL** - получите после создания БД на Render
4. **JWT_SECRET** - сгенерируйте любой секретный ключ (минимум 32 символа)

## Деплой на Render

### 1. Создание аккаунта
- Зарегистрируйтесь на [render.com](https://render.com)
- Подтвердите email
- Подключите GitHub аккаунт

### 2. Создание PostgreSQL базы данных
1. В Render Dashboard → New → PostgreSQL
2. Name: `list-db`
3. Database: `list_db`
4. User: `list_user`
5. Region: Frankfurt (для РФ)
6. Plan: Free
7. Создайте базу данных

### 3. Получение DATABASE_URL
1. Откройте созданную базу данных
2. Скопируйте `Internal Database URL` из раздела Connections
3. Формат: `postgresql://list_user:password@host:5432/list_db`

### 4. Деплой Backend
1. В Render Dashboard → New → Web Service
2. Connect GitHub репозиторий
3. Root directory: `backend`
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Region: Frankfurt
7. Plan: Free

### 5. Переменные окружения для Backend
Добавьте в Environment Variables:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=<скопированный URL из шага 3>
JWT_SECRET=<сгенерируйте секретный ключ>
TELEGRAM_BOT_TOKEN=8782833735:AAEg9DlxwpaH6rdq_Wue34lWrgkxEcm2PXA
MINI_APP_URL=https://list-frontend.onrender.com
REDIS_URL=redis://localhost:6379
REDIS_AVAILABLE=false
SENTRY_DSN=<опционально>
```

### 6. Получение URL бэкенда
После деплоя Render предоставит URL вида:
`https://list-backend.onrender.com`

### 7. Деплой Frontend
1. В Render Dashboard → New → Static Site
2. Connect GitHub репозиторий
3. Root directory: `frontend`
4. Build Command: `npm install && npm run build`
5. Publish directory: `dist`
6. Region: Frankfurt
7. Plan: Free

### 8. Переменные окружения для Frontend
Добавьте в Environment Variables:

```
VITE_API_URL=https://list-backend.onrender.com/api
```

### 9. Получение URL фронтенда
После деплоя Render предоставит URL вида:
`https://list-frontend.onrender.com`

### 10. Настройка Telegram Bot
1. Откройте @BotFather
2. `/setwebhook`
3. Выберите бота
4. Введите: `https://list-backend.onrender.com/api/webhook`

### 11. Настройка WebApp в Telegram
1. Откройте @BotFather
2. `/mybots` → выберите бота
3. `/newapp` → создайте приложение
4. В поле "URL" введите: `https://list-frontend.onrender.com`

## Локальная разработка

### Запуск с Docker
```bash
docker-compose up -d
cd backend
npm run dev
```

### Запуск без Docker
```bash
# PostgreSQL должен быть установлен локально
cd backend
npm run db:push
npm run dev
```

## Траблшутинг

### Бэкенд не просыпается (Render Free)
- Free план спит через 15 мин неактивности
- Первый запрос занимает ~30 сек
- Решение: upgrade до Starter ($7/месяц)

### CORS ошибки
- Убедитесь, что `https://list-frontend.onrender.com` добавлен в CORS бэкенда
- Проверьте `VITE_API_URL` в фронтенде

### Telegram WebApp не работает
- Убедитесь, что бэкенд доступен из интернета
- Проверьте webhook URL
- Откройте консоль браузера для логов

### База данных не подключается
- Проверьте DATABASE_URL
- Убедитесь, что база данных в том же регионе
- Проверьте логи в Render Dashboard
