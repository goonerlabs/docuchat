import { EventEmitter } from "node:events";

// One emitter for the full application (publish/subscribe).
// A service says "this happened". Listeners do the side effects.
export const appEvents = new EventEmitter();

// Node warns at 11 listeners for one event. 20 is sufficient for us.
appEvents.setMaxListeners(20);
