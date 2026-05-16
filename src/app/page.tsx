import ChatPage from '@/components/pages/ChatPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function Page() {
  return (
    <ProtectedRoute>
      <ChatPage />
    </ProtectedRoute>
  )
}
