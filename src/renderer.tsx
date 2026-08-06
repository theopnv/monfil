import { createRoot } from "react-dom/client";

const App = () => {
  return <h1>Hello from React!</h1>;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found");
}
const root = createRoot(container);
root.render(<App />);
