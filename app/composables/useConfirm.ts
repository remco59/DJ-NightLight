export type ConfirmOptions = {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Optional middle choice, e.g. "Opslaan zonder e-mail". */
  secondaryLabel?: string
  /** "danger" styles the confirm button for destructive actions. */
  tone?: 'default' | 'danger'
}

export type ConfirmChoice = 'confirm' | 'secondary' | null

type ConfirmState = ConfirmOptions & { open: boolean, resolve: ((value: ConfirmChoice) => void) | null }

// One dialog for the whole app (rendered by <ConfirmHost> in app.vue). It only
// changes in response to a click in the browser, so module state is safe here.
const state = reactive<ConfirmState>({ open: false, title: '', resolve: null })

export function useConfirmState() {
  return state
}

function ask(options: ConfirmOptions) {
  state.resolve?.(null)
  return new Promise<ConfirmChoice>((resolve) => {
    Object.assign(state, { body: undefined, confirmLabel: undefined, cancelLabel: undefined, secondaryLabel: undefined, tone: 'default', ...options, open: true, resolve })
  })
}

/** In-app replacement for window.confirm(): resolves true when the user confirms. */
export function useConfirm() {
  return async (options: ConfirmOptions) => (await ask(options)) === 'confirm'
}

/** Like useConfirm, with a third button: resolves 'confirm', 'secondary' or null (cancelled). */
export function useChoice() {
  return (options: ConfirmOptions & { secondaryLabel: string }) => ask(options)
}
