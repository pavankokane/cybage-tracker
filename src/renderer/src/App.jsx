import Dashboard from './Dashboard';

export default function App() {
  // 🟢 FIXED: Checking the correct object exposed by electron-vite's contextBridge
  if (!window.electronAPI) {
    return (
      <div className="min-h-screen bg-slate-950 text-red-400 font-mono flex items-center justify-center p-8">
        <div className="bg-slate-900 border border-red-900/50 p-6 rounded-xl max-w-md text-center shadow-2xl">
          ⚠️ Context Bridge Isolation Connection Missing.
        </div>
      </div>
    );
  }

  return <Dashboard />;
}