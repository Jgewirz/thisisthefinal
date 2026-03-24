import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { ChatView } from "./components/ChatView";
import { SavedFlightsView } from "./components/SavedFlightsView";
import { CalendarView } from "./components/CalendarView";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      {
        index: true,
        Component: () => <ChatView agentId="all" />
      },
      {
        path: "style",
        Component: () => <ChatView agentId="style" />
      },
      {
        path: "travel",
        Component: () => <ChatView agentId="travel" />
      },
      {
        path: "fitness",
        Component: () => <ChatView agentId="fitness" />
      },
      {
        path: "lifestyle",
        Component: () => <ChatView agentId="lifestyle" />
      },
      {
        path: "saved",
        Component: SavedFlightsView,
      },
      {
        path: "calendar",
        Component: CalendarView,
      },
    ],
  },
]);
