import { register, init, getLocaleFromNavigator } from 'svelte-i18n'

register('en', () => import('./en.json'))

export function setupI18n() {
  init({
    fallbackLocale: 'en',
    initialLocale: 'en',
  })
}

export { getLocaleFromNavigator }
