import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { AuthScreen } from '../features/auth/AuthScreen';
import { ChatProvider } from '../features/chat/ChatContext';
import { ChatLayout } from '../features/chat/components/ChatLayout';

function Root() {
  const { state } = useAuth();

  switch (state.status) {
    case 'loading':
      return <div className="splash">Loading…</div>;
    case 'anonymous':
      return <AuthScreen />;
    case 'authenticated':
      return (
        <ChatProvider key={state.session.user.id} session={state.session}>
          <ChatLayout />
        </ChatProvider>
      );
  }
}

export function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
