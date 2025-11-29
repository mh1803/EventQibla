type AuthChangeCallback = (isAuthenticated: boolean) => void;

const subscribers = new Set<AuthChangeCallback>();

export const emitAuthChange = (isAuthenticated: boolean): void => {
  subscribers.forEach((callback) => callback(isAuthenticated));
};

export const subscribeToAuthChanges = (
  callback: AuthChangeCallback
): (() => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

export const unsubscribeFromAuthChanges = (
  callback: AuthChangeCallback
): void => {
  subscribers.delete(callback);
};
