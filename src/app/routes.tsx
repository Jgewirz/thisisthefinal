import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { ChatView } from "./components/ChatView";
import { LoginScreen } from "./components/LoginScreen";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/forgot",
    Component: ForgotPasswordScreen,
  },
  {
    path: "/reset",
    Component: ResetPasswordScreen,
  },
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
    ],
  },
]);
