---
name: security-review
description: Использовать этот навык при добавлении аутентификации, обработке пользовательского ввода, работе с секретами, создании API-эндпоинтов или реализации платёжных и других чувствительных функций. Даёт полный чек-лист безопасности и приёмы.
---

# Навык проверки безопасности

Этот навык следит за тем, чтобы весь код соответствовал лучшим практикам безопасности, и помогает находить возможные уязвимости.

## Когда включать

- Реализация аутентификации или авторизации
- Обработка пользовательского ввода или загрузки файлов
- Создание новых API-эндпоинтов
- Работа с секретами или учётными данными
- Реализация платёжных функций
- Хранение или передача чувствительных данных
- Интеграция со сторонними API

## Чек-лист безопасности

### 1. Управление секретами

#### ❌ НИКОГДА так не делайте
```typescript
const apiKey = "sk-proj-xxxxx"  // Секрет прямо в коде
const dbPassword = "password123" // В исходном коде
```

#### ✅ ВСЕГДА делайте так
```typescript
const apiKey = process.env.OPENAI_API_KEY
const dbUrl = process.env.DATABASE_URL

// Убедиться, что секреты заданы
if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

#### Что проверить
- [ ] Нет API-ключей, токенов и паролей прямо в коде
- [ ] Все секреты — в переменных окружения
- [ ] `.env.local` добавлен в .gitignore
- [ ] Нет секретов в истории git
- [ ] Секреты продакшена — на хостинг-платформе (Vercel, Railway)

### 2. Проверка входных данных

#### Всегда проверяйте пользовательский ввод
```typescript
import { z } from 'zod'

// Описать схему проверки
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150)
})

// Проверить перед обработкой
export async function createUser(input: unknown) {
  try {
    const validated = CreateUserSchema.parse(input)
    return await db.users.create(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    throw error
  }
}
```

#### Проверка загружаемых файлов
```typescript
function validateFileUpload(file: File) {
  // Проверка размера (не больше 5 МБ)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('File too large (max 5MB)')
  }

  // Проверка типа
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type')
  }

  // Проверка расширения
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif']
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('Invalid file extension')
  }

  return true
}
```

#### Что проверить
- [ ] Весь пользовательский ввод проверяется по схемам
- [ ] Загрузка файлов ограничена (размер, тип, расширение)
- [ ] Пользовательский ввод не используется в запросах напрямую
- [ ] Проверка по белому списку (а не по чёрному)
- [ ] Сообщения об ошибках не раскрывают чувствительные данные

### 3. Защита от SQL-инъекций

#### ❌ НИКОГДА не склеивайте SQL
```typescript
// ОПАСНО — уязвимость к SQL-инъекции
const query = `SELECT * FROM users WHERE email = '${userEmail}'`
await db.query(query)
```

#### ✅ ВСЕГДА используйте параметризованные запросы
```typescript
// Безопасно — параметризованный запрос
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userEmail)

// Или с «сырым» SQL
await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
)
```

#### Что проверить
- [ ] Все запросы к базе параметризованы
- [ ] Нет склейки строк в SQL
- [ ] ORM или построитель запросов используется правильно
- [ ] Запросы к Supabase правильно очищаются

### 4. Аутентификация и авторизация

#### Работа с JWT-токенами
```typescript
// ❌ НЕПРАВИЛЬНО: localStorage (уязвим к XSS)
localStorage.setItem('token', token)

// ✅ ПРАВИЛЬНО: cookie с флагом httpOnly
res.setHeader('Set-Cookie',
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`)
```

#### Проверки авторизации
```typescript
export async function deleteUser(userId: string, requesterId: string) {
  // ВСЕГДА сначала проверяйте авторизацию
  const requester = await db.users.findUnique({
    where: { id: requesterId }
  })

  if (requester.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }

  // Продолжить удаление
  await db.users.delete({ where: { id: userId } })
}
```

#### Row Level Security (Supabase)
```sql
-- Включить RLS на всех таблицах
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Пользователи видят только свои данные
CREATE POLICY "Users view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Пользователи изменяют только свои данные
CREATE POLICY "Users update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

#### Что проверить
- [ ] Токены хранятся в cookie с httpOnly (а не в localStorage)
- [ ] Авторизация проверяется перед чувствительными операциями
- [ ] В Supabase включена Row Level Security
- [ ] Реализован доступ на основе ролей
- [ ] Управление сессиями безопасно

### 5. Защита от XSS

#### Очищайте HTML
```typescript
import DOMPurify from 'isomorphic-dompurify'

// ВСЕГДА очищайте HTML от пользователя
function renderUserContent(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
    ALLOWED_ATTR: []
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

#### Content Security Policy
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' https://api.example.com;
    `.replace(/\s{2,}/g, ' ').trim()
  }
]
```

#### Что проверить
- [ ] HTML от пользователя очищается
- [ ] Заголовки CSP настроены
- [ ] Нет вывода непроверенного динамического содержимого
- [ ] Используется встроенная защита React от XSS

### 6. Защита от CSRF

#### CSRF-токены
```typescript
import { csrf } from '@/lib/csrf'

export async function POST(request: Request) {
  const token = request.headers.get('X-CSRF-Token')

  if (!csrf.verify(token)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  // Обработать запрос
}
```

#### Cookie с SameSite
```typescript
res.setHeader('Set-Cookie',
  `session=${sessionId}; HttpOnly; Secure; SameSite=Strict`)
```

#### Что проверить
- [ ] CSRF-токены на операциях, меняющих состояние
- [ ] SameSite=Strict на всех cookie
- [ ] Реализован приём double-submit cookie

### 7. Ограничение частоты запросов

#### Ограничение для API
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов за окно
  message: 'Too many requests'
})

// Применить к маршрутам
app.use('/api/', limiter)
```

#### Дорогие операции
```typescript
// Жёсткое ограничение для поиска
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // 10 запросов в минуту
  message: 'Too many search requests'
})

app.use('/api/search', searchLimiter)
```

#### Что проверить
- [ ] Ограничение частоты на всех API-эндпоинтах
- [ ] Более строгие ограничения для дорогих операций
- [ ] Ограничение по IP
- [ ] Ограничение по пользователю (для аутентифицированных)

### 8. Раскрытие чувствительных данных

#### Логирование
```typescript
// ❌ НЕПРАВИЛЬНО: в лог попадают чувствительные данные
console.log('User login:', { email, password })
console.log('Payment:', { cardNumber, cvv })

// ✅ ПРАВИЛЬНО: скрывать чувствительные данные
console.log('User login:', { email, userId })
console.log('Payment:', { last4: card.last4, userId })
```

#### Сообщения об ошибках
```typescript
// ❌ НЕПРАВИЛЬНО: раскрываются внутренние детали
catch (error) {
  return NextResponse.json(
    { error: error.message, stack: error.stack },
    { status: 500 }
  )
}

// ✅ ПРАВИЛЬНО: общие сообщения об ошибках
catch (error) {
  console.error('Internal error:', error)
  return NextResponse.json(
    { error: 'An error occurred. Please try again.' },
    { status: 500 }
  )
}
```

#### Что проверить
- [ ] Нет паролей, токенов и секретов в логах
- [ ] Пользователь видит общие сообщения об ошибках
- [ ] Подробности ошибок — только в серверных логах
- [ ] Пользователю не показываются стектрейсы

### 9. Безопасность блокчейна (Solana)

#### Проверка кошелька
```typescript
import { verify } from '@solana/web3.js'

async function verifyWalletOwnership(
  publicKey: string,
  signature: string,
  message: string
) {
  try {
    const isValid = verify(
      Buffer.from(message),
      Buffer.from(signature, 'base64'),
      Buffer.from(publicKey, 'base64')
    )
    return isValid
  } catch (error) {
    return false
  }
}
```

#### Проверка транзакции
```typescript
async function verifyTransaction(transaction: Transaction) {
  // Проверить получателя
  if (transaction.to !== expectedRecipient) {
    throw new Error('Invalid recipient')
  }

  // Проверить сумму
  if (transaction.amount > maxAmount) {
    throw new Error('Amount exceeds limit')
  }

  // Проверить, что у пользователя достаточно средств
  const balance = await getBalance(transaction.from)
  if (balance < transaction.amount) {
    throw new Error('Insufficient balance')
  }

  return true
}
```

#### Что проверить
- [ ] Подписи кошельков проверяются
- [ ] Детали транзакций проверяются
- [ ] Баланс проверяется перед транзакциями
- [ ] Нет «слепого» подписания транзакций

### 10. Безопасность зависимостей

#### Регулярные обновления
```bash
# Проверить уязвимости
npm audit

# Автоматически исправить то, что можно
npm audit fix

# Обновить зависимости
npm update

# Найти устаревшие пакеты
npm outdated
```

#### Lock-файлы
```bash
# ВСЕГДА коммитьте lock-файлы
git add package-lock.json

# В CI/CD — для воспроизводимых сборок
npm ci  # Вместо npm install
```

#### Что проверить
- [ ] Зависимости обновлены
- [ ] Нет известных уязвимостей (npm audit чист)
- [ ] Lock-файлы закоммичены
- [ ] На GitHub включён Dependabot
- [ ] Регулярные обновления безопасности

## Тестирование безопасности

### Автоматические тесты безопасности
```typescript
// Проверка аутентификации
test('requires authentication', async () => {
  const response = await fetch('/api/protected')
  expect(response.status).toBe(401)
})

// Проверка авторизации
test('requires admin role', async () => {
  const response = await fetch('/api/admin', {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  expect(response.status).toBe(403)
})

// Проверка валидации ввода
test('rejects invalid input', async () => {
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email' })
  })
  expect(response.status).toBe(400)
})

// Проверка ограничения частоты
test('enforces rate limits', async () => {
  const requests = Array(101).fill(null).map(() =>
    fetch('/api/endpoint')
  )

  const responses = await Promise.all(requests)
  const tooManyRequests = responses.filter(r => r.status === 429)

  expect(tooManyRequests.length).toBeGreaterThan(0)
})
```

## Чек-лист безопасности перед развёртыванием

Перед ЛЮБЫМ развёртыванием в продакшен:

- [ ] **Секреты**: нет секретов в коде, всё в переменных окружения
- [ ] **Проверка ввода**: весь пользовательский ввод проверяется
- [ ] **SQL-инъекции**: все запросы параметризованы
- [ ] **XSS**: пользовательское содержимое очищается
- [ ] **CSRF**: защита включена
- [ ] **Аутентификация**: токены обрабатываются правильно
- [ ] **Авторизация**: проверки ролей на месте
- [ ] **Ограничение частоты**: включено на всех эндпоинтах
- [ ] **HTTPS**: обязателен в продакшене
- [ ] **Заголовки безопасности**: настроены CSP, X-Frame-Options
- [ ] **Обработка ошибок**: нет чувствительных данных в ошибках
- [ ] **Логирование**: чувствительные данные не логируются
- [ ] **Зависимости**: обновлены, без уязвимостей
- [ ] **Row Level Security**: включена в Supabase
- [ ] **CORS**: настроен правильно
- [ ] **Загрузка файлов**: проверяется (размер, тип)
- [ ] **Подписи кошельков**: проверяются (если есть блокчейн)

## Материалы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Безопасность в Next.js](https://nextjs.org/docs/security)
- [Безопасность в Supabase](https://supabase.com/docs/guides/auth)
- [Web Security Academy](https://portswigger.net/web-security)

---

**Помните**: безопасность не опциональна. Одна уязвимость может скомпрометировать всю платформу. Если сомневаетесь — выбирайте более осторожный вариант.
