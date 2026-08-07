import { useCallback, useState } from "react";

export default function App() {
  const [nodeVersion, setNodeVersion] = useState<string | undefined>(undefined);

  const updateNodeVersion = useCallback(
    async () => {
      const nodeVersion = await window.electron.ipcRenderer.invoke('utils:get-node-version');
      setNodeVersion(nodeVersion) },
    []
  );

  return (
    <div className="App">
      <button onClick={updateNodeVersion}>
        Node version is {nodeVersion}
      </button>
    </div>
  );
}
