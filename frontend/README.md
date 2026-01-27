# AutoAcct Frontend - Dark Minimalist Upload UI

A Next.js 14 frontend application for AutoAcct receipt upload and OCR results management.

## Features

- 🎨 **Dark Minimalist Design** - Muji-inspired aesthetic with calm, functional interface
- 📤 **Drag & Drop Upload** - Intuitive file upload with validation (PNG/JPG, max 5MB)
- 📊 **Real-time Processing** - Live status updates during OCR processing
- 🤖 **AI-Powered Extraction** - Automated vendor, amount, and date extraction with confidence scores
- ✂️ **Split Transaction Support** - Granular review of individual line items with AI category suggestions
- ✏️ **Inline Editing** - Review and correct OCR results before confirmation
- ✅ **Workflow Actions** - Confirm, edit, or reject extracted data

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.0+
- **Styling:** Tailwind CSS 3.4+
- **UI Components:** Radix UI (unstyled primitives)
- **Forms:** React Hook Form + Zod validation
- **State Management:**
  - **Global:** Zustand
  - **Server State:** TanStack React Query
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **File Upload:** react-dropzone
- **HTTP Client:** Axios

## Prerequisites

- Node.js 18+ or Bun
- Backend API running on `http://localhost:3001`

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local if needed (optional)
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

## Development

```bash
# Start development server
npm run dev

# Open browser
# http://localhost:3000/upload
```

## Build

```bash
# Production build
npm run build

# Start production server
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── upload/page.tsx          # Main upload page
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Design system CSS
│
├── components/
│   ├── ui/                      # Base components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   ├── Progress.tsx
│   │   └── Toast.tsx
│   │
│   └── Receipt/                 # Receipt-specific components
│       ├── ReceiptUploader.tsx
│       ├── UploadProgressCard.tsx
│       ├── OcrResultCard.tsx
│       └── ConfidenceBadge.tsx
│
├── hooks/
│   ├── useReceiptUpload.ts      # Upload mutation
│   ├── useReceiptPolling.ts     # Status polling
│   └── use-toast.ts             # Toast management
│
├── lib/
│   ├── api-client.ts            # Axios instance + API methods
│   └── utils.ts                 # Utility functions
│
└── types/
    └── api.types.ts             # TypeScript API types
```

## Design System

### Colors

- **Background:** `#0A0A0A` (app), `#141414` (surface)
- **Text:** `#ECECEC` (primary), `#A3A3A3` (secondary)
- **Accent:** `#3B82F6` (trust blue)
- **Success:** `#10B981`
- **Warning:** `#F59E0B`
- **Error:** `#EF4444`

### Typography

- **Sans Serif:** Inter
- **Monospace:** JetBrains Mono (amounts)

### Spacing

- Base unit: 8px
- All spacing follows 8px multiples

## API Integration

### Backend Requirements

1. Start backend server:
```bash
cd ../backend
bun run dev
```

2. Backend must be running on `http://localhost:3001`

### API Endpoints

- `POST /api/receipts/upload` - Upload receipt
- `GET /api/receipts/:id` - Get receipt status + OCR results
- `POST /api/receipts/:id/confirm` - Confirm and create draft transaction
- `DELETE /api/receipts/:id` - Delete receipt

## File Upload Constraints

- **Accepted formats:** PNG, JPG
- **Max file size:** 5MB
- **Max files per batch:** 10

## Currency Format

- **Display:** Baht (฿125.00)
- **API submission:** Satang (integer)
  - 1 THB = 100 Satang
  - ฿125.00 = 12,500 Satang

## Keyboard Navigation

- `Tab` - Navigate between elements
- `Enter` - Activate buttons
- `Esc` - Close dialogs/cancel edits

## Accessibility

- WCAG AA color contrast (4.5:1)
- Keyboard navigation support
- ARIA labels on icons
- Screen reader friendly

## Troubleshooting

### CORS Errors

If you encounter CORS errors, ensure backend has CORS middleware enabled for `http://localhost:3000`.

### API Connection Failed

1. Check backend is running on `http://localhost:3001`
2. Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
3. Check network tab for actual API URL

### File Upload Fails

1. Check file size (max 5MB)
2. Verify file type (PNG/JPG only)
3. Check backend file upload middleware

## License

Proprietary - AutoAcct Project
