import { ChatWindow } from '../chat/ChatWindow'
import { SessionPanel } from './SessionPanel'

export function AppShell() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-100 px-4">
          <h1 className="text-lg font-bold text-gray-900">CRM Agent</h1>
          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            AI
          </span>
        </div>
        <SessionPanel />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
          <h2 className="text-base font-semibold text-gray-800">
            Agentic CRM Assistant
          </h2>
        </header>
        <div className="flex-1 overflow-hidden">
          <ChatWindow />
        </div>
      </main>
    </div>
  )
}
