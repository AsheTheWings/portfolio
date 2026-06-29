/**
 * MSW lifecycle for the "node" Jest project. Starts the mock backend before
 * the suite, resets per-test overrides, and tears down at the end. Unhandled
 * requests error so accidental real network calls are caught.
 */
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
