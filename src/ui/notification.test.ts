import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Notification,
  NotificationCard,
  NotificationProvider,
  NotificationViewport,
  createNotificationStore,
  notificationRole,
  type NotificationOptions,
} from './notification.js'

const html = (...args: Parameters<typeof createElement>) => renderToStaticMarkup(createElement(...args))

describe('notification card', () => {
  it('announces errors as alerts and every other tone as a polite status', () => {
    expect(notificationRole('error')).toEqual({ role: 'alert', 'aria-live': 'assertive' })
    for (const tone of ['info', 'loading', 'success', 'warning'] as const)
      expect(notificationRole(tone)).toEqual({ role: 'status', 'aria-live': 'polite' })

    const error = html(NotificationCard, { tone: 'error', message: 'Terrain failed' })
    expect(error).toContain('role="alert"')
    expect(error).toContain('aria-live="assertive"')
    expect(error).toContain('data-notification-tone="error"')
    expect(error).toContain('Terrain failed')
  })

  it('shows title, message, actions and a dismiss button with its label', () => {
    const markup = html(NotificationCard, {
      tone: 'info',
      title: 'Update ready',
      message: 'Reload to update.',
      'aria-label': 'Application update available',
      actions: createElement('button', { type: 'button' }, 'Reload'),
      onDismiss: () => {},
      dismissLabel: 'Dismiss update',
    })
    expect(markup).toContain('aria-label="Application update available"')
    expect(markup).toContain('Update ready')
    expect(markup).toContain('data-notification-message=""')
    expect(markup).toContain('>Reload</button>')
    expect(markup).toContain('aria-label="Dismiss update"')
  })

  it('draws a determinate progress bar named after the job, with its step count', () => {
    const markup = html(NotificationCard, {
      tone: 'loading',
      title: 'Comparing routes',
      message: 'Searching corridor',
      progress: { value: 3, max: 4 },
    })
    expect(markup).toContain('role="progressbar"')
    expect(markup).toContain('aria-label="Comparing routes"')
    expect(markup).toContain('aria-valuenow="3"')
    expect(markup).toContain('aria-valuemax="4"')
    expect(markup).toContain('width:75%')
    expect(markup).toContain('3 of 4')
    expect(markup).not.toContain('Dismiss notification')
  })

  it('takes an icon override and can drop the icon', () => {
    const custom = html(NotificationCard, { message: 'x', icon: createElement('svg', { 'data-custom': 'yes' }) })
    expect(custom).toContain('data-custom="yes"')
    expect(html(NotificationCard, { message: 'x', icon: null })).not.toContain('<svg')
  })
})

describe('notification stack', () => {
  it('places one labelled stack that lets clicks through to the page', () => {
    const markup = html(NotificationViewport, { label: 'Workspace notices' })
    expect(markup).toContain('<section aria-label="Workspace notices"')
    expect(markup).toContain('pointer-events-none')
    expect(markup).toContain('fixed')
    expect(markup).toContain('z-notification')
  })

  it('renders every notice in a shared store in one stack, keeping store fields off the DOM', () => {
    const store = createNotificationStore<NotificationOptions>()
    store.push({ id: 'update', tone: 'info', message: 'Update ready', duration: 1234 })
    store.push({ id: 'job', tone: 'loading', message: 'Loading terrain' })
    const markup = html(NotificationProvider, { store }, createElement('main', null, 'page'))
    expect(markup.match(/<section/g)).toHaveLength(1)
    expect(markup.indexOf('Update ready')).toBeLessThan(markup.indexOf('Loading terrain'))
    // A pushed info notice can be closed; a running job cannot.
    expect(markup.match(/aria-label="Dismiss notification"/g)).toHaveLength(1)
    expect(markup).not.toContain('1234')
    expect(markup).toContain('<main>page</main>')
  })

  it('renders a notification on its own when no provider is mounted', () => {
    const markup = html(Notification, { tone: 'error', message: 'Export failed', onDismiss: () => {} })
    expect(markup).toContain('<section aria-label="Notifications"')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('aria-label="Dismiss notification"')
  })
})
