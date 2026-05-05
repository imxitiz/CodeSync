import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import EditorPage from "./pages/EditorPageModern/EditorPageModern";
import HomePage from "./pages/HomePageModern/HomePageModern";

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "editor/:id",
    element: <EditorPage />,
  },
]);

function App() {
  useEffect(() => {
    document.title = "CodeSync";
  }, []);

  return (
    <>
      <div>
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              style: {
                background: "#4aee88",
                color: "white",
              },
            },
          }}
        />
      </div>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
