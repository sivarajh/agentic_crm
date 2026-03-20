import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore, useConversationStore, useAgentStore, useProjectStore } from '@/store'
import type { ConversationHistoryEntry } from '@/store'
import { sessionApi } from '@/api/sessionApi'
import { conversationApi } from '@/api/conversationApi'
import { projectApi } from '@/api/projectApi'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

export function SessionPanel() {
  const [isCreating, setIsCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmDeleteConvId, setConfirmDeleteConvId] = useState<string | null>(null)
  const [isDeletingConvId, setIsDeletingConvId] = useState<string | null>(null)

  // Projects UI state
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null)
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null)
  const [moveMenuConvId, setMoveMenuConvId] = useState<string | null>(null)

  const newProjectInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const { currentSession, setSession } = useSessionStore()
  const {
    currentConversation,
    conversationHistory,
    viewingConversationId,
    setConversation,
    addToHistory,
    removeFromHistory,
    setViewingConversation,
    clearMessages,
  } = useConversationStore()
  const { setAgentStatus, clearStreamingContent } = useAgentStore()
  const {
    projects, conversationProjects,
    setProjects, addProject, removeProject, updateProject, setConversationProject,
  } = useProjectStore()

  useEffect(() => {
    if (currentSession) {
      sessionApi.get(currentSession.sessionId).then((s) => {
        if (s.state !== 'ACTIVE') setSession(null)
      }).catch(() => setSession(null))
    }
    async function loadHistory() {
      try {
        const [{ content: sessions }, fetchedProjects] = await Promise.all([
          sessionApi.list(DEMO_USER_ID),
          projectApi.list(DEMO_USER_ID),
        ])
        setProjects(fetchedProjects)
        for (const session of sessions) {
          const conversations = await conversationApi.listBySession(session.sessionId)
          for (const conv of conversations) {
            addToHistory(conv)
            if (conv.projectId) setConversationProject(conv.conversationId, conv.projectId)
          }
        }
      } catch (e) {
        console.error('Failed to load conversation history from backend:', e)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    if (isCreatingProject) newProjectInputRef.current?.focus()
  }, [isCreatingProject])

  useEffect(() => {
    if (renamingProjectId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingProjectId])

  async function startNewSession() {
    setIsCreating(true)
    try {
      if (currentSession) {
        try { await sessionApi.terminate(currentSession.sessionId) } catch (_) { /* ignore */ }
      }
      if (currentConversation) addToHistory(currentConversation)
      const session = await sessionApi.create({ userId: DEMO_USER_ID, agentId: 'iQ Smart Assistant' })
      setSession(session)
      const conversation = await conversationApi.create(session.sessionId)
      setConversation(conversation)
      clearMessages()
      clearStreamingContent()
      setAgentStatus('idle')
      navigate('/')
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }

  function copyLink(conversationId: string) {
    const url = `${window.location.origin}/conversation/${conversationId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(conversationId)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  async function handleConfirmDeleteConv(conversationId: string) {
    setIsDeletingConvId(conversationId)
    try {
      await conversationApi.delete(conversationId)
      if (viewingConversationId === conversationId) navigate('/')
      removeFromHistory(conversationId)
      setConversationProject(conversationId, null)
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    } finally {
      setIsDeletingConvId(null)
      setConfirmDeleteConvId(null)
    }
  }

  async function handleCreateProject() {
    const trimmed = newProjectName.trim()
    setNewProjectName('')
    setIsCreatingProject(false)
    if (!trimmed) return
    try {
      const project = await projectApi.create(DEMO_USER_ID, trimmed)
      addProject(project)
    } catch (e) {
      console.error('Failed to create project:', e)
    }
  }

  async function handleRenameProject() {
    const trimmed = renameValue.trim()
    const id = renamingProjectId
    setRenamingProjectId(null)
    setRenameValue('')
    if (!trimmed || !id) return
    try {
      const project = await projectApi.rename(id, trimmed)
      updateProject(project)
    } catch (e) {
      console.error('Failed to rename project:', e)
    }
  }

  async function handleAssignConversation(conversationId: string, projectId: string | null, currentProjectId: string | undefined) {
    // Optimistic update
    setConversationProject(conversationId, projectId)
    try {
      if (projectId) {
        await projectApi.assignConversation(projectId, conversationId)
      } else if (currentProjectId) {
        await projectApi.unassignConversation(currentProjectId, conversationId)
      }
    } catch (e) {
      console.error('Failed to assign conversation to project:', e)
      // Revert
      setConversationProject(conversationId, currentProjectId ?? null)
    }
  }

  async function handleDeleteProject(projectId: string) {
    setConfirmDeleteProjectId(null)
    // Optimistic update
    removeProject(projectId)
    try {
      await projectApi.delete(projectId)
    } catch (e) {
      console.error('Failed to delete project:', e)
      // Re-fetch projects to restore state
      projectApi.list(DEMO_USER_ID).then(setProjects).catch(() => {})
    }
  }

  function toggleCollapse(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const activeConvId = viewingConversationId ?? currentConversation?.conversationId
  const ungroupedConvs = conversationHistory.filter(
    (e) => !conversationProjects[e.conversationId] && e.conversationId !== currentConversation?.conversationId
  )

  function renderConvItem(entry: ConversationHistoryEntry, indented = false) {
    const isViewing = viewingConversationId === entry.conversationId
    const isConfirming = confirmDeleteConvId === entry.conversationId
    const isDeleting = isDeletingConvId === entry.conversationId
    const isMoveOpen = moveMenuConvId === entry.conversationId

    if (isConfirming) {
      return (
        <div
          key={entry.conversationId}
          style={{
            borderRadius: 6,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '8px 10px',
            marginBottom: 2,
            marginLeft: indented ? 10 : 0,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--cgpt-danger)', marginBottom: 6 }}>Delete this conversation?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleConfirmDeleteConv(entry.conversationId)}
              disabled={isDeleting}
              style={{ all: 'unset', cursor: isDeleting ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: 'var(--cgpt-danger)', color: '#fff' }}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDeleteConvId(null)}
              disabled={isDeleting}
              style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'var(--cgpt-text-secondary)', padding: '3px 6px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <div key={entry.conversationId} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: 6,
            background: isViewing ? 'var(--cgpt-sidebar-active)' : 'transparent',
            marginBottom: 1,
            marginLeft: indented ? 10 : 0,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { if (!isViewing) (e.currentTarget as HTMLDivElement).style.background = 'var(--cgpt-sidebar-hover)' }}
          onMouseLeave={(e) => { if (!isViewing) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          <button
            onClick={() => navigate(`/conversation/${entry.conversationId}`)}
            style={{ all: 'unset', flex: 1, padding: '8px 10px', cursor: 'pointer', overflow: 'hidden', color: 'var(--cgpt-text-primary)', fontSize: 13 }}
          >
            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.label}
            </span>
          </button>

          {/* Move to project */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMoveMenuConvId(isMoveOpen ? null : entry.conversationId) }}
              title="Move to project"
              style={{ all: 'unset', cursor: 'pointer', padding: '4px 4px', color: 'var(--cgpt-text-muted)', fontSize: 12 }}
            >
              📁
            </button>
            {isMoveOpen && (
              <>
                <div onClick={() => setMoveMenuConvId(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 100,
                  background: 'var(--cgpt-sidebar-bg)', border: '1px solid var(--cgpt-sidebar-border)',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 160, padding: '4px 0',
                }}>
                  {projects.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--cgpt-text-muted)', padding: '6px 12px' }}>No projects yet</div>
                  )}
                  {projects.map((p) => {
                    const isAssigned = conversationProjects[entry.conversationId] === p.projectId
                    return (
                      <button
                        key={p.projectId}
                        onClick={() => { handleAssignConversation(entry.conversationId, isAssigned ? null : p.projectId, conversationProjects[entry.conversationId]); setMoveMenuConvId(null) }}
                        style={{
                          all: 'unset', display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                          padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--cgpt-text-primary)',
                          boxSizing: 'border-box', background: isAssigned ? 'var(--cgpt-sidebar-active)' : 'transparent',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isAssigned ? 'var(--cgpt-sidebar-active)' : 'transparent' }}
                      >
                        {isAssigned && <span style={{ fontSize: 10 }}>✓</span>}
                        {p.name}
                      </button>
                    )
                  })}
                  {conversationProjects[entry.conversationId] && (
                    <>
                      <div style={{ height: 1, background: 'var(--cgpt-sidebar-border)', margin: '4px 0' }} />
                      <button
                        onClick={() => { handleAssignConversation(entry.conversationId, null, conversationProjects[entry.conversationId]); setMoveMenuConvId(null) }}
                        style={{ all: 'unset', display: 'block', width: '100%', padding: '7px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--cgpt-text-muted)', boxSizing: 'border-box' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        Remove from project
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); copyLink(entry.conversationId) }}
            title="Copy shareable link"
            style={{ all: 'unset', cursor: 'pointer', padding: '4px 4px', color: copiedId === entry.conversationId ? 'var(--cgpt-accent)' : 'var(--cgpt-text-muted)', fontSize: 13, flexShrink: 0 }}
          >
            {copiedId === entry.conversationId ? '✓' : '🔗'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDeleteConvId(entry.conversationId) }}
            title="Delete conversation"
            style={{ all: 'unset', cursor: 'pointer', padding: '4px 6px', color: 'var(--cgpt-text-muted)', fontSize: 12, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* New chat button */}
      <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
        <button
          onClick={startNewSession}
          disabled={isCreating}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--cgpt-sidebar-border)', background: 'transparent',
            color: 'var(--cgpt-text-primary)', cursor: isCreating ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.15s', opacity: isCreating ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          {isCreating ? 'Starting…' : 'New chat'}
        </button>

        {currentSession && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cgpt-accent)', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--cgpt-text-secondary)' }}>Session active</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {/* Current conversation */}
        {currentConversation && (
          <>
            <div style={{ height: 1, background: 'var(--cgpt-sidebar-border)', margin: '4px 4px 8px' }} />
            <button
              onClick={() => { setViewingConversation(null); navigate('/') }}
              style={{
                all: 'unset', display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6,
                cursor: 'pointer',
                background: activeConvId === currentConversation.conversationId && viewingConversationId === null
                  ? 'var(--cgpt-sidebar-active)' : 'transparent',
                color: 'var(--cgpt-text-primary)', fontSize: 13, fontWeight: 500,
                boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                if (activeConvId !== currentConversation.conversationId || viewingConversationId !== null)
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)'
              }}
              onMouseLeave={(e) => {
                if (activeConvId !== currentConversation.conversationId || viewingConversationId !== null)
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              💬 Current chat
            </button>
          </>
        )}

        {/* Projects section */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 6px', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
              Projects
            </span>
            <button
              onClick={() => setIsCreatingProject(true)}
              title="New project"
              style={{ all: 'unset', cursor: 'pointer', fontSize: 16, color: 'var(--cgpt-text-muted)', padding: '0 4px', lineHeight: 1, borderRadius: 4 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--cgpt-text-primary)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--cgpt-text-muted)' }}
            >
              +
            </button>
          </div>

          {/* Inline new project input */}
          {isCreatingProject && (
            <div style={{ marginBottom: 6, padding: '0 2px' }}>
              <input
                ref={newProjectInputRef}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName('') }
                }}
                onBlur={handleCreateProject}
                placeholder="Project name…"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 13,
                  border: '1px solid var(--cgpt-accent)', background: 'var(--cgpt-input-bg)',
                  color: 'var(--cgpt-text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {projects.length === 0 && !isCreatingProject && (
            <div style={{ fontSize: 12, color: 'var(--cgpt-text-muted)', padding: '2px 10px 6px', fontStyle: 'italic' }}>
              No projects yet
            </div>
          )}

          {projects.map((project) => {
            const projectConvs = conversationHistory.filter(
              (e) => conversationProjects[e.conversationId] === project.projectId && e.conversationId !== currentConversation?.conversationId
            )
            const isCollapsed = collapsedProjects.has(project.projectId)
            const isMenuOpen = projectMenuId === project.projectId
            const isRenaming = renamingProjectId === project.projectId
            const isConfirmingDelete = confirmDeleteProjectId === project.projectId

            return (
              <div key={project.projectId} style={{ marginBottom: 2, position: 'relative' }}>
                {/* Project header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'background 0.12s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--cgpt-sidebar-hover)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  {isRenaming ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
                      <span style={{ fontSize: 12, color: 'var(--cgpt-text-muted)' }}>▾</span>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameProject()
                          if (e.key === 'Escape') { setRenamingProjectId(null); setRenameValue('') }
                        }}
                        onBlur={handleRenameProject}
                        style={{
                          flex: 1, padding: '3px 8px', borderRadius: 4, fontSize: 13,
                          border: '1px solid var(--cgpt-accent)', background: 'var(--cgpt-input-bg)',
                          color: 'var(--cgpt-text-primary)', outline: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleCollapse(project.projectId)}
                      style={{ all: 'unset', flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', overflow: 'hidden' }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--cgpt-text-muted)', flexShrink: 0, transition: 'transform 0.15s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                      <span style={{ fontSize: 13, color: 'var(--cgpt-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.name}
                      </span>
                      {projectConvs.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--cgpt-text-muted)', background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>
                          {projectConvs.length}
                        </span>
                      )}
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setProjectMenuId(isMenuOpen ? null : project.projectId) }}
                      style={{ all: 'unset', cursor: 'pointer', padding: '4px 8px', color: 'var(--cgpt-text-muted)', fontSize: 14, flexShrink: 0, letterSpacing: 1 }}
                    >
                      ···
                    </button>
                  )}
                </div>

                {/* Project context menu */}
                {isMenuOpen && (
                  <>
                    <div onClick={() => setProjectMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                    <div style={{
                      position: 'absolute', right: 4, top: 32, zIndex: 100,
                      background: 'var(--cgpt-sidebar-bg)', border: '1px solid var(--cgpt-sidebar-border)',
                      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 140, padding: '4px 0',
                    }}>
                      <button
                        onClick={() => { setRenamingProjectId(project.projectId); setRenameValue(project.name); setProjectMenuId(null) }}
                        style={{ all: 'unset', display: 'block', width: '100%', padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--cgpt-text-primary)', boxSizing: 'border-box' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteProjectId(project.projectId); setProjectMenuId(null) }}
                        style={{ all: 'unset', display: 'block', width: '100%', padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--cgpt-danger)', boxSizing: 'border-box' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cgpt-sidebar-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}

                {/* Confirm delete project */}
                {isConfirmingDelete && (
                  <div style={{
                    borderRadius: 6, background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)', padding: '8px 10px', margin: '2px 0 4px',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--cgpt-danger)', marginBottom: 6 }}>
                      Delete "{project.name}"? Conversations will be ungrouped.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleDeleteProject(project.projectId)}
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: 'var(--cgpt-danger)', color: '#fff' }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteProjectId(null)}
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 11, color: 'var(--cgpt-text-secondary)', padding: '3px 6px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Project conversations */}
                {!isCollapsed && (
                  <div>
                    {projectConvs.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--cgpt-text-muted)', padding: '3px 10px 3px 26px', fontStyle: 'italic' }}>
                        No conversations
                      </div>
                    ) : (
                      projectConvs.map((entry) => renderConvItem(entry, true))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Ungrouped conversations */}
        {ungroupedConvs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 1, background: 'var(--cgpt-sidebar-border)', margin: '0 4px 8px' }} />
            <div style={{ padding: '0 4px 6px' }}>
              <span style={{ fontSize: 11, color: 'var(--cgpt-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Conversations
              </span>
            </div>
            {ungroupedConvs.map((entry) => renderConvItem(entry, false))}
          </div>
        )}
      </div>
    </div>
  )
}
