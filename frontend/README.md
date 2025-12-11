# Security Management System - Frontend

Modern and responsive frontend for the hotel security management system.

## Tech Stack

- **Vite** - Fast build tool
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client

## Features

- ✅ Modern and clean UI
- ✅ Responsive design
- ✅ Role-based access control
- ✅ JWT authentication
- ✅ Real-time updates
- ✅ Easy to learn interface

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

3. Update `.env` with your backend API URL (default: <http://localhost:5000/api>)

4. Run health check:

```bash
npm run health
```

5. Start development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run health` - Run health check
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── pages/          # Page components
│   ├── Login.tsx
│   └── Dashboard.tsx
├── components/     # Reusable components
├── utils/          # Utility functions
│   └── api.ts      # Axios configuration
├── App.tsx         # Main app component
├── main.tsx        # Entry point
└── index.css       # Global styles (Tailwind)
```

## Pages

- `/login` - Login page
- `/dashboard` - Main dashboard (protected)
- More pages coming soon...

## Development

This project uses:

- **Vite** for fast HMR
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Router** for navigation
