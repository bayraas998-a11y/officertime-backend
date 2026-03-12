# Employee Tracking System - Backend API

Компанийн ажилчдын үйл ажиллагаа, цаг хугацаа, уулзалт болон ажлын прогресс сүүлчлэх REST API.

## Функционал

✅ **Ажилтны үйлдэл:**
- Нэвтрэх / Бүртгүүлэх (JWT Authentication)
- Ажилд ирэх/гарах цага сүүлчлэл (Check-in/Check-out)
- Өнөөдрийн үйл ажиллагаа харах
- Ажлын төлөвлөгөө үүсгэх, өөрчлөх, үнэлэх
- Уулзалт бүртгүүлэх

✅ **Администратор/Менежер:**
- Бүх ажилтнуудын статус харах
- Ажилтнуудын цаг хугацааны отчет авах
- Ажилтнуудын уулзалт, ажлын төлөвлөгөө харах
- Excel/PDF형식의 отчет экспорт

## Технологи

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Password:** bcryptjs

## Суулгах заавал

### 1. PostgreSQL суулгах

Windows дээр [PostgreSQL download](https://www.postgresql.org/download/windows/) хийнэ.

### 2. Төсөл үнэлгээ

```bash
cd employee-tracking-backend
npm install
```

### 3. Database үүсгэх

```sql
CREATE DATABASE employee_tracking_db;
```

Дараа нь `schema.sql` ашиглан таблицуудыг үүсгэнэ:

```bash
psql -U postgres -d employee_tracking_db -f src/config/schema.sql
```

### 4. .env файл өөрчлөх

`.env` файлыг ашиглан database холболтыг тохируулна:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=employee_tracking_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
```

### 5. Сервер эхлүүлэх

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Сервер `http://localhost:5000` дээр ажиллана.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Ажилтан бүртгүүлэх
- `POST /api/auth/login` - Нэвтрэх

### Attendance (Ажилд ирэх/гарах)
- `POST /api/attendance/check-in` - Ажилд ирэх
- `POST /api/attendance/check-out` - Ажилаас гарах
- `GET /api/attendance/today` - Өнөөдрийн үйл ажиллагаа
- `GET /api/attendance/report` - Цаг хугацааны отчет

### Tasks (Ажлын төлөвлөгөө)
- `GET /api/tasks` - Бүх ажлууд
- `GET /api/tasks/stats` - Ажлын статистик
- `POST /api/tasks` - Ажил үүсгэх
- `PUT /api/tasks/:id` - Ажил өөрчлөх
- `DELETE /api/tasks/:id` - Ажил устгах

### Meetings (Уулзалт)
- `GET /api/meetings` - Бүх уулзалтууд
- `POST /api/meetings` - Уулзалт үүсгэх
- `PUT /api/meetings/:id` - Уулзалт өөрчлөх
- `DELETE /api/meetings/:id` - Уулзалт устгах

### Reports (Отчет)
- `GET /api/reports/employee` - Ажилтны отчет
- `POST /api/reports/pdf` - PDF экспорт
- `POST /api/reports/excel` - Excel экспорт

## Example Requests

### Бүртгүүлэх
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Батаа",
    "last_name": "Пүрэв",
    "email": "bataa@company.com",
    "password": "password123",
    "position": "Software Engineer",
    "department": "IT"
  }'
```

### Нэвтрэх
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bataa@company.com",
    "password": "password123"
  }'
```

### Ажилд ирэх
```bash
curl -X POST http://localhost:5000/api/attendance/check-in \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Project Structure

```
employee-tracking-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── schema.sql
│   ├── controllers/
│   │   ├── AuthController.js
│   │   ├── AttendanceController.js
│   │   ├── TaskController.js
│   │   ├── MeetingController.js
│   │   └── ReportController.js
│   ├── models/
│   │   ├── Employee.js
│   │   ├── Attendance.js
│   │   ├── Task.js
│   │   └── Meeting.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── attendance.js
│   │   ├── tasks.js
│   │   ├── meetings.js
│   │   └── reports.js
│   ├── middleware/
│   │   └── auth.js
│   └── server.js
├── .env
├── package.json
└── README.md
```

## Дараагийн алхамууд

- [ ] Web Frontend (React) үүсгэх
- [ ] Mobile App (React Native) үүсгэх
- [ ] Excel/PDF экспорт функцион гүйцэтгэх
- [ ] Real-time статус обновления (Socket.io) нэмэх
- [ ] Email notifications нэмэх
