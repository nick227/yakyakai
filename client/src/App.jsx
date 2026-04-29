import { useCallback } from 'react'
import { Bot } from 'lucide-react'
import { RUN_STATUS } from './lib/uiConstants.js'
import AppFrame from './components/AppFrame.jsx'
import AuthGate from './components/AuthGate.jsx'
import ChatStream from './components/ChatStream.jsx'
import RunComposer from './components/RunComposer.jsx'
import AdminView from './components/AdminView.jsx'
import SessionSidebar from './components/SessionSidebar.jsx'
import HydratorLibraryTest from './components/HydratorLibraryTest.jsx'
import Profile from './components/Profile.jsx'
import { useAppController } from './hooks/useAppController.js'
import { useAuth } from './hooks/useAuth.js'

const isHydratorSmokeEnabled = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('hydratorTest') === '1'
}

const isHydratorLibraryTestEnabled = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('hydratorLibTest') === '1'
}

function App({ user, onLogout }) {
  const { state, actions, derived } = useAppController()
  const showHydratorSmoke = isHydratorSmokeEnabled()
  const showHydratorLibraryTest = isHydratorLibraryTestEnabled()

  const handleLogout = useCallback(async () => {
    onLogout()
  }, [onLogout])

  const handleProfileClick = useCallback(() => {
    actions.navigateToProfile()
  }, [actions])

  if (state.isProfile) {
    return (
      <AppFrame
        user={user}
        status={state.status}
        showAdmin={state.uiState.showAdmin}
        onAdmin={actions.toggleAdmin}
        onLogout={handleLogout}
        onSidebar={actions.openSidebar}
        onProfile={handleProfileClick}
      >
        <SessionSidebar
          isOpen={state.uiState.showSidebar}
          currentSessionId={state.sessionId}
          onClose={actions.closeSidebar}
          onNavigate={actions.navigateToSession}
          onNewChat={actions.startNewChat}
          onSessionDeleted={actions.startNewChat}
        />
        <Profile 
          user={user} 
          onLogout={handleLogout}
        />
      </AppFrame>
    )
  }

  return (
    <AppFrame
      user={user}
      status={state.status}
      showAdmin={state.uiState.showAdmin}
      onAdmin={actions.toggleAdmin}
      onLogout={handleLogout}
      onSidebar={actions.openSidebar}
      onProfile={handleProfileClick}
    >
      {showHydratorLibraryTest ? (
        <HydratorLibraryTest />
      ) : (
        <>
      <SessionSidebar
        isOpen={state.uiState.showSidebar}
        currentSessionId={state.sessionId}
        onClose={actions.closeSidebar}
        onNavigate={actions.navigateToSession}
        onNewChat={actions.startNewChat}
        onSessionDeleted={actions.startNewChat}
      />
      {state.uiState.showAdmin ? (
        <main className="center-page">
          <AdminView onClose={actions.toggleAdmin} />
        </main>
      ) : (
        <main className="chat-shell">
          <ChatStream
            outputs={state.outputs}
            chatMessages={state.chatMessages}
            plan={state.plan}
            status={state.status}
            riverRef={state.riverRef}
            onScroll={actions.handleScroll}
            isLoadingMessages={state.isLoadingMessages}
            sessionNotFound={state.uiState.sessionNotFound}
            onNewChat={actions.startNewChat}
            showHydratorSmoke={showHydratorSmoke}
          />
          <RunComposer
            prompt={state.prompt}
            pace={state.pace}
            isActive={derived.isActive}
            canStart={derived.canStart}
            canPause={derived.canPause}
            canResume={derived.canResume}
            canStop={derived.canStop}
            runError={state.runError}
            promptCount={derived.promptCount}
            approxTokens={derived.approxTokens}
            cycleCount={state.cycleCount}
            nextDelay={state.nextDelay}
            sessionId={state.sessionId}
            messages={state.chatMessages}
            onPromptChange={actions.setPrompt}
            onPaceChange={actions.setPace}
            onStart={actions.start}
            onPause={actions.pauseRun}
            onResume={actions.resumeRun}
            onStop={actions.stopRun}
          />
        </main>
      )}
        </>
      )}
    </AppFrame>
  )
}

export default function Root() {
  const { user, loading, logout, setUser } = useAuth()

  if (loading) {
    return (
      <AppFrame status={RUN_STATUS.IDLE}>
        <main className="center-page splash-page">
          <div className="brand-mark splash-mark"><Bot size={28} /></div>
        </main>
      </AppFrame>
    )
  }

  if (!user) return <AuthGate onAuth={setUser} />
  return <App user={user} onLogout={logout} />
}
