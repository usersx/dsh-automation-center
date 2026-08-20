import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject } from '../src/client/index.ts'

test('client contributes one global page and one root sidebar action', async () => {
  const registrations: Array<{ options: any; component: unknown }> = []
  const injectedSlots: string[] = []
  const openedPages: string[] = []
  const openedSessions: string[] = []
  const calls: string[] = []
  const ctx = {
    effect: () => {},
    connection: {
      rpc: {
        call: async (_channel: string, endpoint: string) => {
          calls.push(endpoint)
          if (endpoint === 'snapshot') {
            return { ok: true, value: { workspaces: [], presets: [], automations: [], runs: [], migration: { detectedDefinitions: 0, detectedRuns: 0, importedDefinitions: 0, importedRuns: 0 }, serverNow: new Date().toISOString() } }
          }
          return { ok: true, value: {} }
        },
      },
    },
    layout: {
      surface: { getSnapshot: () => ({ kind: 'conversation' as const }), subscribe: () => () => {} },
      openPage: (pageId: string) => { openedPages.push(pageId) },
      showConversation: () => { calls.push('show-conversation') },
    },
    sessions: {
      refresh: async () => { calls.push('sessions-refresh') },
      open: (sessionId: string) => { openedSessions.push(sessionId) },
    },
    locale: {
      register: () => () => {},
      bind: () => (key: string) => key,
    },
    slots: {
      inject: (name: string, register: () => void) => { injectedSlots.push(name); register() },
      register: (options: any, component: unknown) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  assert.deepEqual(inject, ['slots', 'locale', 'connection', 'sessions', 'layout'])
  apply(ctx as never)
  assert.deepEqual(injectedSlots, ['shell.page', 'sidebar.primary.action'])
  assert.deepEqual(registrations.map(item => [item.options.name, item.options.id]), [
    ['shell.page', 'automation'],
    ['sidebar.primary.action', 'automation'],
  ])

  const sidebar = registrations.find(item => item.options.name === 'sidebar.primary.action')!.options.inject()
  sidebar.open()
  assert.deepEqual(openedPages, ['automation'])
  assert.equal(sidebar.hooks.shellSurface, ctx.layout.surface)

  const page = registrations.find(item => item.options.name === 'shell.page')!.options.inject()
  await page.openSession('run-1', 'session-result')
  assert.deepEqual(openedSessions, ['session-result'])
  assert.deepEqual(calls, ['sessions-refresh', 'show-conversation', 'mark-read', 'snapshot'])
})

test('stock rc.8 falls back to the native conversation view without shell slots', async () => {
  const registrations: Array<{ options: any; component: unknown }> = []
  const injectedSlots: string[] = []
  const openedSessions: string[] = []
  const calls: string[] = []
  const ctx = {
    effect: () => {},
    connection: {
      rpc: {
        call: async (_channel: string, endpoint: string) => {
          calls.push(endpoint)
          if (endpoint === 'snapshot') {
            return { ok: true, value: { workspaces: [], presets: [], automations: [], runs: [], migration: { detectedDefinitions: 0, detectedRuns: 0, importedDefinitions: 0, importedRuns: 0 }, serverNow: new Date().toISOString() } }
          }
          return { ok: true, value: {} }
        },
      },
    },
    layout: {},
    sessions: {
      refresh: async () => { calls.push('sessions-refresh') },
      open: (sessionId: string) => { openedSessions.push(sessionId) },
    },
    locale: {
      register: () => () => {},
      bind: () => (key: string) => key,
    },
    slots: {
      inject: (name: string, register: () => void) => { injectedSlots.push(name); register() },
      register: (options: any, component: unknown) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  apply(ctx as never)
  assert.deepEqual(injectedSlots, ['conversation.view'])
  assert.deepEqual(registrations.map(item => [item.options.name, item.options.id]), [
    ['conversation.view', 'automation'],
  ])
  assert.equal(registrations[0]!.options.label(), 'tab')

  const page = registrations[0]!.options.inject('session-current')
  await page.openSession('run-1', 'session-result')
  assert.deepEqual(openedSessions, ['session-result'])
  assert.deepEqual(calls, ['sessions-refresh', 'mark-read', 'snapshot'])
})

test('a stock-shaped layout always chooses the declared conversation dependency', () => {
  const injectedSlots: string[] = []
  const ctx = {
    effect: () => {},
    connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
    sessions: { refresh: async () => {}, open: () => {} },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    slots: {
      inject: (name: string) => { injectedSlots.push(name) },
    },
  }
  apply(ctx as never)
  assert.deepEqual(injectedSlots, ['conversation.view'])
})
