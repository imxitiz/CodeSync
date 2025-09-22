import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import EditorPage from "./pages/EditorPage/EditorPage";
import HomePage from "./pages/HomePage/HomePage";

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
              theme: {
                colors: {
                  primary: "#4aee88",
                },
              },
            },
          }}
        />
      </div>
      <RouterProvider future={{ v7_partialHydration: true }} router={router} />
    </>
  );
}

export default App;
