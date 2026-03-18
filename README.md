 # Responsive English Vocabulary App
 
 Ứng dụng học từ vựng tiếng Anh xây dựng với Vite + React + TypeScript + TailwindCSS v4. Backend tùy chọn bằng Supabase Edge Functions; nếu backend không khả dụng, ứng dụng sẽ tự động dùng localStorage để hoạt động ngoại tuyến.
 
 - Công nghệ chính: Vite 6, React 18, React Router, TailwindCSS v4, Radix UI/MUI, Supabase JS v2
 - Thư mục nguồn giao diện: `src/`
 - Hàm Supabase (tùy chọn): `supabase/functions/server`
 
 ## Yêu cầu hệ thống
 - Windows 10/11
 - Node.js 20 LTS (khuyến nghị) hoặc >= 18.18
 - npm đi kèm Node.js (hoặc pnpm/yarn nếu bạn thích)
 
 Kiểm tra nhanh sau khi cài:
 
 ```bash
 node -v
 npm -v
 ```
 
 ## Cài đặt Node.js khi bạn “chưa có npm”
 1. Tải Node.js LTS từ https://nodejs.org và cài đặt (tick “Automatically install the necessary tools” nếu được hỏi).
 2. Mở một cửa sổ Terminal mới (PowerShell) và kiểm tra `node -v`, `npm -v`. Nếu có phiên bản hiển thị, bạn đã sẵn sàng.
 
 (Tùy chọn) Cài thêm pnpm:
 ```bash
 npm i -g pnpm
 ```
 
 ## Cài đặt phụ thuộc
 Mở Terminal tại thư mục dự án:
 
 ```bash
 cd Responsiveenglishvocabularyapp
 npm install
 ```
 
 Lưu ý: project này khai báo `react` và `react-dom` là peerDependencies. Nếu npm cảnh báo “Cannot find module 'react'/'react-dom'”, hãy cài thêm:
 
 ```bash
 npm i react@18.3.1 react-dom@18.3.1
 ```
 
 (Nếu dùng pnpm)
 ```bash
 pnpm install
 pnpm add react@18.3.1 react-dom@18.3.1
 ```
 
 ## Chạy môi trường phát triển
 ```bash
 npm run dev
 ```
 Mặc định Vite chạy ở http://localhost:5173.
 
 - Ứng dụng có cơ chế fallback: nếu không kết nối được Supabase, dữ liệu sẽ lưu trong localStorage để bạn dùng thử đầy đủ tính năng cốt lõi (tạo bộ sưu tập, thêm từ vựng, làm quiz…).
 - Mã nguồn khởi tạo tại: [index.html](./index.html), [src/main.tsx](./src/main.tsx), [src/app/App.tsx](./src/app/App.tsx), [src/app/routes.tsx](./src/app/routes.tsx).
 
 ## Build và xem bản build
 ```bash
 npm run build
 ```
 Kết quả xuất ra thư mục `dist/`. Để xem thử bản build:
 ```bash
 npx vite preview
 ```
 (hoặc thêm script `preview: "vite preview"` nếu muốn)
 
 ## Cấu hình Supabase (tùy chọn)
 Ứng dụng đã nhúng khóa “public anon key” và `projectId` để hoạt động ngay:
 - Client và API: [src/app/lib/api.ts](./src/app/lib/api.ts), [utils/supabase/info.tsx](./utils/supabase/info.tsx)
 - Hàm Edge (Deno + Hono): [supabase/functions/server](./supabase/functions/server)
 
 Bạn có thể chạy hoàn toàn không cần backend (dùng localStorage). Nếu muốn dùng đầy đủ backend:
 1. Tạo Project Supabase và lấy các biến: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
 2. Cập nhật `utils/supabase/info.tsx` với `projectId` và `publicAnonKey` của bạn.
 3. Tạo bảng KV như file: [supabase/functions/server/kv_store.tsx](./supabase/functions/server/kv_store.tsx) (bảng mẫu `kv_store_06e2d339`).
 4. Deploy hàm Edge `server` lên Supabase Functions, đảm bảo đặt biến môi trường:
    - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (dùng trong server)
    - `SUPABASE_ANON_KEY` (cho luồng đăng nhập)
 
 Lưu ý bảo mật: chỉ “public anon key” mới được dùng phía client. Tuyệt đối không đưa `SERVICE_ROLE_KEY` vào frontend.
 
 ## Khắc phục sự cố thường gặp
 - Lỗi “Cannot find module 'react' or 'react-dom'”: cài thêm
   ```bash
   npm i react@18.3.1 react-dom@18.3.1
   ```
 - Node quá thấp, Vite báo lỗi: cập nhật Node lên >= 18 (khuyến nghị 20 LTS).
 - Port 5173 bị chiếm: chạy `npm run dev -- --port 5174` hoặc đặt biến `--host`.
 - Không thấy CSS/Tailwind: kiểm tra import tại [src/styles/index.css](./src/styles/index.css) và plugin Tailwind ở [vite.config.ts](./vite.config.ts).
 
 ## Cấu trúc nhanh
 - Giao diện: `src/app/components/*`, điều hướng: `src/app/routes.tsx`
 - API client và fallback: `src/app/lib/api.ts`, `src/app/lib/localStorage.ts`
 - Vite cấu hình: `vite.config.ts`
 - Hàm Supabase (tùy chọn): `supabase/functions/server/*`
 
 ---
 
 ### Bắt đầu nhanh (tóm tắt)
 1) Cài Node LTS → 2) `npm i` → 3) `npm i react react-dom` nếu thiếu → 4) `npm run dev` → mở http://localhost:5173 → sẵn sàng dùng thử với localStorage.  
 Khi cần bản sản xuất: `npm run build` rồi `npx vite preview`.
