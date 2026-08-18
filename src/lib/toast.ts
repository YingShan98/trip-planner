type Listener = (msg: string) => void;

let listener: Listener | null = null;

export function registerToastListener(fn: Listener | null) {
  listener = fn;
}

export function toast(msg: string) {
  listener?.(msg);
}
