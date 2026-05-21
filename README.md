# 📚 Emble Bot — ระบบติดตามการบ้าน

บอท Discord สำหรับจัดการและติดตามการบ้านของห้องเรียน พร้อมระบบแจ้งเตือน, ลงทะเบียน, และ Google Sheets เป็นฐานข้อมูล

---

## 📁 โครงสร้างไฟล์

```
emble-bot/
├── src/
│   ├── index.js              # Entry point หลัก
│   ├── config.js             # ค่าคงที่ทั้งหมด
│   ├── handlers/
│   │   ├── buttons.js        # จัดการปุ่มทุกปุ่ม
│   │   ├── selects.js        # จัดการ dropdown menu
│   │   └── modals.js         # จัดการ modal form
│   ├── modals/
│   │   └── index.js          # สร้าง modal ทุกชนิด
│   └── utils/
│       ├── sheets.js         # Google Sheets API helper
│       ├── auth.js           # ระบบ password hash + session
│       ├── reminders.js      # ระบบแจ้งเตือนและ daily summary
│       └── panel.js          # สร้าง Panel embed + components
├── .env.example              # ตัวอย่างตัวแปรสภาพแวดล้อม
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ การติดตั้งและใช้งาน

### 1. สร้าง Discord Bot
1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. สร้าง Application ใหม่ → สร้าง Bot
3. เปิด **Server Members Intent** และ **Message Content Intent**
4. คัดลอก **Token** และ **Client ID**
5. Invite bot ด้วย scope: `bot`, `applications.commands` และ permissions: `Send Messages`, `Read Message History`, `Embed Links`

### 2. สร้าง Google Sheet
1. สร้าง Google Sheet ใหม่ที่ [Google Sheets](https://sheets.google.com)
2. คัดลอก **Sheet ID** จาก URL: `https://docs.google.com/spreadsheets/d/**[SHEET_ID]**/edit`
3. บอทจะสร้าง tab ทั้งหมดอัตโนมัติเมื่อเริ่มต้น (Users, Subjects, Homework, Completion)

### 3. สร้าง Google Service Account
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. สร้าง Project ใหม่ → เปิดใช้งาน **Google Sheets API**
3. ไปที่ **IAM & Admin → Service Accounts → สร้าง Service Account**
4. สร้าง Key ประเภท JSON → ดาวน์โหลด
5. เปิดไฟล์ JSON ที่ดาวน์โหลด → คัดลอกเนื้อหาทั้งหมด
6. **Share** Google Sheet กับ email ของ Service Account (ให้สิทธิ์ Editor)

### 4. ตั้งค่า Environment Variables
คัดลอก `.env.example` เป็น `.env` แล้วกรอกข้อมูล:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
GUILD_ID=your_discord_server_id
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CREDENTIALS={"type":"service_account",...}  # วางทั้ง JSON ในบรรทัดเดียว
```

### 5. ติดตั้งและรัน (Local)
```bash
npm install
npm start
```

---

## 🚀 Deploy บน Render

1. Push โค้ดขึ้น GitHub (อย่าลืม commit `.gitignore` ก่อนเพื่อไม่ให้ `.env` ติดไป)
2. ไปที่ [Render.com](https://render.com) → New → **Web Service**
3. เชื่อมต่อ GitHub Repository
4. ตั้งค่า:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. ไปที่ **Environment** → เพิ่มตัวแปรทั้งหมดจาก `.env`
6. สำหรับ `GOOGLE_CREDENTIALS`: วาง JSON ทั้งหมดในบรรทัดเดียว (ไม่มี line break)
7. Deploy!

> ⚠️ **สำคัญ**: Render Free Tier จะ sleep เมื่อไม่มีการใช้งาน ทำให้ระบบแจ้งเตือนหยุดทำงาน แนะนำให้ใช้ **Paid Plan** หรือตั้ง Health Check URL

---

## 📋 Google Sheets Structure

| Sheet Tab    | คอลัมน์                                                           |
|--------------|------------------------------------------------------------------|
| **Users**      | discordId, firstName, lastName, studentId, passwordHash        |
| **Subjects**   | subjectCode, subjectName, credits, instructor                  |
| **Homework**   | homeworkId, subjectCode, title, details, imageUrl, link, dueDate, assignDate, addedBy |
| **Completion** | homeworkId, studentId, completedAt                             |

---

## 🎮 วิธีใช้งาน

### สำหรับนักศึกษา
1. กด **📝 ลงทะเบียน** → กรอกชื่อ, นามสกุล, รหัสนักศึกษา, รหัสผ่าน
2. กด **🔑 เข้าสู่ระบบ** → กรอกรหัสนักศึกษา + รหัสผ่าน
3. กด **➕ เพิ่มการบ้าน** → เลือกวิชา → กรอกรายละเอียดงาน
4. กด **📋 ดูการบ้าน** → ดูรายการงานทั้งหมด
5. กด **✅ ตรวจสอบงาน** → ทำเครื่องหมายงานที่ส่งแล้ว

### สำหรับ Admin (Role ID: 1480919691982667826)
1. กด **⚙️ จัดการวิชา** → เพิ่มวิชาใหม่
2. กด **🗑️ ลบการบ้าน** → ดูรายการ ID แล้วใช้ modal ลบ
3. กด **👥 จัดการผู้ใช้** → ดูรายชื่อและลบผู้ใช้

---

## 🔔 ระบบแจ้งเตือน DM

บอทจะส่ง DM อัตโนมัติเมื่อ:
- 📬 มีการบ้านใหม่ถูกเพิ่ม
- 📅 อีก **1 วัน** ก่อนครบกำหนด
- ⏰ อีก **12 ชั่วโมง** ก่อนครบกำหนด
- 🚨 อีก **1 ชั่วโมง** ก่อนครบกำหนด
- 📊 สรุปประจำวันส่งให้ Discord ID `918320537443385396` ทุกวัน 08:00 น.

---

## ❓ แก้ปัญหาเบื้องต้น

| ปัญหา | วิธีแก้ |
|-------|---------|
| Bot ไม่ตอบสนอง | ตรวจสอบ TOKEN และ GUILD_ID |
| ไม่สามารถเขียน Sheets | ตรวจสอบว่า Share Sheet ให้ Service Account แล้ว |
| Modal ไม่แสดง | ตรวจสอบว่า Bot มี permission `applications.commands` |
| DM ไม่ถูกส่ง | ผู้ใช้อาจปิด DM หรือ bot sleep บน Render Free |
