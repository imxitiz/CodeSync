# CodeSync

CodeSync is a real-time collaborative code editor that allows multiple users to work together on code simultaneously. Built with React and Socket.io, it provides a seamless experience for code collaboration, making it easy to share code and ideas in real-time.

## Features

- **Real-time Collaboration**: Edit code together with others in real-time.
- **Room Management**: Create or join rooms with unique Room IDs.
- **Editable Control**: The room creator can assign or revoke editing privileges.
- **User Authentication**: Users can join with unique usernames.
- **Copy Room ID and Code**: Easily share the Room ID and copy code snippets.

## Technologies Used

- **Frontend**: React.js, React Router, CodeMirror, React Icons, React Hot Toast
- **Backend**: Node.js, Express.js, Socket.io
- **Styling**: CSS
- **Utilities**: RandomColor, React Avatar

## Deployment

This application is designed to be deployed with separate frontend and backend services:

### Frontend Deployment (Vercel/Netlify)

1. **Build the frontend:**

   ```bash
   npm run build
   ```

2. **Set environment variables:**
   - `VITE_BACKEND_API_URL`: Your backend server URL (e.g., `https://your-app.onrender.com`)

3. **Deploy the `dist` folder** to your preferred hosting service.

Note for Vercel users: If you deploy a single-page app (SPA) on Vercel and navigate directly to nested routes like `/editor/test`, Vercel may return a 404 if it doesn't serve `index.html` for that path. This repo includes a `vercel.json` rewrite rule that maps all non-API routes to `index.html` so client-side routing works correctly.

### Backend Deployment (Render/Railway/Heroku)

1. **Set environment variables:**
   - `CORS_ORIGIN`: Your frontend URL (e.g., `https://your-app.vercel.app`)
   - `PORT`: Server port (default: 3000)

2. **Deploy the backend** with the following files:
   - `server.js`
   - `action.js`
   - `package.json`

3. **The backend provides these endpoints:**
   - `GET /api/health` - Health check endpoint
   - `GET /api/info` - Server information
   - Socket.io endpoint for real-time communication

### Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create `.env` file** (copy from `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. **Start the backend:**

   ```bash
   npm run server
   ```

4. **Start the frontend (in another terminal):**

   ```bash
   npm run dev
   ```

### Environment Variables

- **Frontend (`.env`):**
  - `VITE_BACKEND_API_URL`: Backend server URL

- **Backend (environment variables):**
  - `CORS_ORIGIN`: Allowed frontend origins (comma-separated)
  - `PORT`: Server port (default: 3000)

## Health Check & Server Wake-up

The application includes automatic server wake-up functionality:

- **Health Check**: Frontend checks server health before connecting
- **Auto Wake-up**: Server is pinged when user focuses on input fields
- **Retry Logic**: Automatic retry with user feedback during connection
- **Smooth UX**: Users can enter details while server wakes up
