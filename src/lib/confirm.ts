export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

type Listener = (request: ConfirmRequest) => void;

let listener: Listener | null = null;

export function registerConfirmListener(fn: Listener | null) {
  listener = fn;
}

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) { resolve(window.confirm(message)); return; }
    listener({ message, options, resolve });
  });
}
