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

## Setup and Run Locally

To set up and run the project locally, follow these steps:

1. **Clone the repository**:
   ```sh
   git clone https://github.com/imxitiz/CodeSync.git
   cd CodeSync
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add the following:
   ```sh
   DATABASE_URL=your_database_url
   VITE_BACKEND_API_URL=your_backend_api_url
   ```

4. **Run the project**:
   ```sh
   npm run dev:front
   npm run server
   ```

## Contributing

To contribute to the project, follow these steps:

1. **Fork the repository**:
   Click the "Fork" button at the top right of the repository page.

2. **Clone your forked repository**:
   ```sh
   git clone https://github.com/your-username/CodeSync.git
   cd CodeSync
   ```

3. **Create a new branch**:
   ```sh
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**:
   Implement your feature or bug fix.

5. **Commit your changes**:
   ```sh
   git add .
   git commit -m "Add your commit message"
   ```

6. **Push to your branch**:
   ```sh
   git push origin feature/your-feature-name
   ```

7. **Create a pull request**:
   Go to the original repository and click the "New Pull Request" button.

## Project Architecture and File Structure

The project follows a standard architecture with separate folders for different parts of the application:

- **src**: Contains the source code for the frontend.
  - **components**: Reusable React components.
  - **pages**: Different pages of the application.
  - **utils**: Utility functions and constants.
- **public**: Static assets like images and icons.
- **server.js**: The main server file for the backend.
- **prisma**: Database schema and migrations.

## Running Tests and Linting

To run tests and lint the code, use the following commands:

- **Run tests**:
  ```sh
  npm test
  ```

- **Lint the code**:
  ```sh
  npm run lint
  ```

## Screenshots

Here are some screenshots to help you understand the project better:

### Home Page
![Home Page](screenshots/homepage.png)

### Editor Page
![Editor Page](screenshots/editorpage.png)
