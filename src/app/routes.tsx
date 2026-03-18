import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Login } from "./components/auth/Login";
import { Signup } from "./components/auth/Signup";
import { Dashboard } from "./components/Dashboard";
import { CollectionDetail } from "./components/CollectionDetail";
import { ImageExtraction } from "./components/ImageExtraction";
import { QuizPage } from "./components/QuizPage";
import { QuizResults } from "./components/QuizResults";
import { QuizHistory } from "./components/QuizHistory";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Root,
      children: [
        { index: true, Component: Login },
        { path: "signup", Component: Signup },
        { path: "dashboard", Component: Dashboard },
        { path: "collections/:id", Component: CollectionDetail },
        { path: "collections/:id/extract/:imageId", Component: ImageExtraction },
        { path: "quiz/:id", Component: QuizPage },
        { path: "quiz/:id/results", Component: QuizResults },
        { path: "history", Component: QuizHistory },
        { path: "*", Component: NotFound },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
