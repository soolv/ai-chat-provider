# ai-chat-provider

```sh
npm install @soolv/ai-chat-provider
```

This package is a companion to [Vercel's AI SDK](https://github.com/vercel/ai), specifically `useChat` from `ai/react`.

The use-case for this is when you have multiple components that interact with the same chat.
You can of course structure your components in a way that you only have one `useChat` call and pass props, but this is not always convenient.

`useChat` is designed so that _data_ is shared when `id` and `api` match, but "setup" like `generateId()` and handlers like `onFinish` or `onError` are not.
Also, it might feel awkward to ensure that only one `useChat` invocation specifies `initialMessages`.

## Example

> [!IMPORTANT]
> When using any of the `onX` callbacks, make sure the references are stable (typically with `useCallback`).

The `value` prop for `AiChatProvider` accepts the same arguments as `useChat` except the `onX` handlers.
These should instead be passed as arguments to `useAiChat`.

```tsx
import { AiChatProvider, useAiChat, type UseChatHandlers } from '@soolv/ai-chat-provider';

export function Page() {
  return (
    <AiChatProvider
      value={{
        id: '...',
        api: '...',
        initialMessages: [],
        generateId() {
          return createId();
        }
      }}
    >
      <MessageView />
      <AddMessageButton />
    </AiChatProvider>
  );
}

function MessageView() {
  const { messages } = useAiChat({
    onFinish: useCallback<UseChatHandlers['onFinish']>(
      async (_message, _options) => {
        console.log("MessageView: onFinish!")
      },
      []
    ),
  });

  return (
    <ul>
      { messages.map((m) => <li key={m.id}>{m.content}</li>) }
    </ul>
  );
}

function AddMessageButton() {
  const { append } = useAiChat({
    onFinish: useCallback<UseChatHandlers['onFinish']>(
      async (_message, _options) => {
        console.log("AddMessageButton: onFinish!")
      },
      []
    ),
  })

  return (
    <button
      type="button"
      onClick={() => {
        append({
          role: 'user',
          content: 'This is a user message'
        });
      }}
    >
      Send user message
    </button>
  );
}
```

## Development

Install [bun](https://bun.sh/docs/installation).

```sh
# lint
bun run lint

# build
bun run build
```

## License

MIT
